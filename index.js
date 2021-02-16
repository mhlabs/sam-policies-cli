#!/usr/bin/env node
const fs = require("fs");
const intrinsicFunctionsMap = require("./intrinsicFunctionMap");
const axios = require("axios");
const YAML = require("./yaml-wrapper");
const templateParser = require("./template-parser");
const inputHelper = require("./input-helper");
let parser = JSON;

const program = require("commander");
program.version("1.0.7", "-v, --vers", "output the current version");
program
  .option("-f, --format <json|yaml>", "Select output format", "json")
  .option("-t, --template <filename>", "Template file name", "template.yaml")
  .action(async (cmd) => {
    run(cmd.template, cmd.format);
  });

program.parse(process.argv);

const SAM_SCHEMA_URL =
  "https://raw.githubusercontent.com/awslabs/serverless-application-model/master/samtranslator/policy_templates_data/policy_templates.json";
async function run(templateFile, format) {
  let template = undefined;

  if (!fs.existsSync(templateFile)) {
    console.error(
      `File ${templateFile} does not exist. Use sam-pol -t <template name> to parse your template.`
    );
    return;
  }

  const templateJson = fs.readFileSync(templateFile).toString();
  try {
    template = JSON.parse(templateJson);
  } catch {
    try {
      template = YAML.parse(templateJson);
    } catch {
      console.error(`Template file could not be parsed as ${format}`);
      return;
    }
  }
  const resources = templateParser.getFormattedResourceList(template);
  const lambdas = templateParser.getLambdaFunctions(template);
  const resource = await inputHelper.selectResource(resources);
  const resourceType = handleSAMResources(resource);
  const resourceName = resource.split(" ")[1];
  const policyTemplatesResponse = await axios.get(SAM_SCHEMA_URL);
  const policyTemplates = policyTemplatesResponse.data.Templates;

  let availableTemplates;
  if (resource !== "Not templated") {
    availableTemplates = Object.keys(policyTemplates).filter((p) =>
      policyTemplates[p].Definition.Statement[0].Action[0].startsWith(
        `${resourceType}:`
      )
    );
  } else {
    availableTemplates = Object.keys(policyTemplates).sort();
  }

  const policyTemplate = await inputHelper.selectPolicyTemplate(
    availableTemplates,
    resourceType
  );

  const lambda = await inputHelper.selectLambdaFunction(lambdas);

  const policies = template.Resources[lambda].Properties.Policies || [];
  const parameterKeys = Object.keys(policyTemplates[policyTemplate].Parameters);
  const parameters = await buildParameters(
    parameterKeys,
    resourceType,
    resourceName
  );

  injectPolicy(policyTemplate, parameters, policies, template, lambda);

  fs.copyFileSync(templateFile, templateFile + "_backup");
  fs.writeFileSync(templateFile, parser.stringify(template, null, 2));
}

function injectPolicy(policyTemplate, parameters, policies, template, lambda) {
  const policy = {};
  policy[policyTemplate] = parameters;
  policies.push(policy);
  template.Resources[lambda].Properties.Policies = policies;
}

async function buildParameters(parameterKeys, resourceType, resourceName) {
  let parameters = {};
  for (const parameterKey of parameterKeys) {
    const intrinsicFunctionKey = `${resourceType}:${parameterKey}`;
    const funcResponse = intrinsicFunctionsMap.get(intrinsicFunctionKey);
    parameters[parameterKey] = {};
    if (resourceType === inputHelper.NOT_TEMPLATED) {
      parameters[parameterKey] = await inputHelper.getFreeText(parameterKey);
    } else {
      funcResponse.func.splice(1, 0, resourceName);
      const func = funcResponse.func.shift();
      parameters[parameterKey][func] =
        funcResponse.func.length === 1
          ? funcResponse.func[0]
          : funcResponse.func;
    }
  }
  return parameters;
}

function handleSAMResources(resource) {
  if (resource.startsWith("[AWS::Serverless::Function")) return "lambda";
  if (resource.startsWith("[AWS::Serverless::SimpleTable")) return "dynamodb";
  if (resource.includes("::")) {
    return resource.split("::")[1].toLowerCase();
  }
  return resource;
}
