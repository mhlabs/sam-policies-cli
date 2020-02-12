#!/usr/bin/env node
const fs = require("fs");
const intrinsicFunctionsMap = require("./intrinsicFunctionMap");
const axios = require("axios");
const YAML = require("./yaml-wrapper");
const program = require("commander");
const templateParser = require("./template-parser");
const inputHelper = require("./input-helper");
let parser = JSON;

program.version("1.0.0", "-v, --vers", "output the current version");
program
  .option("-f, --format <json|yaml>", "Select output format", "json")
  .option(
    "-t, --template <filename>",
    "Template file name",
    "serverless.template"
  )
  .action(async cmd => {
    if (cmd.format.toLowerCase().startsWith("y")) {
      parser = YAML;
    }
    run(cmd.template, cmd.format);
  });

program.parse(process.argv);

const SAM_SCHEMA_URL =
  "https://raw.githubusercontent.com/awslabs/serverless-application-model/develop/samtranslator/policy_templates_data/policy_templates.json";
async function run(templateFile, format) {
  if (!fs.existsSync(templateFile)) {
    console.error(`File ${templateFile} does not exist`);
    return;
  }

  const templateJson = fs.readFileSync(templateFile).toString();
  let template = undefined;
  try {
    template = parser.parse(templateJson);
  } catch {
    console.error(`Template file could not be parsed as ${format}`);
    return;
  }
  const resources = templateParser.getFormattedResourceList(template);
  const lambdas = templateParser.getLambdaFunctions(template);
  const resource = await inputHelper.selectResource(resources);
  const resourceType = handleSAMResources(resource);
  const resourceName = resource.split(" ")[1];
  const policyTemplatesResponse = await axios.get(SAM_SCHEMA_URL);
  const policyTemplates = policyTemplatesResponse.data.Templates;

  const availableTemplates = Object.keys(policyTemplates).filter(p =>
    policyTemplates[p].Definition.Statement[0].Action[0].startsWith(
      `${resourceType}:`
    )
  );

  const policyTemplate = await inputHelper.selectPolicyTemplate(
    availableTemplates,
    resourceType
  );

  const lambda = await inputHelper.selectLambdaFunction(lambdas);

  const policies = template.Resources[lambda].Properties.Policies || [];
  const parameterKeys = Object.keys(policyTemplates[policyTemplate].Parameters);
  const parameters = buildParameters(parameterKeys, resourceType, resourceName);

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

function buildParameters(parameterKeys, resourceType, resourceName) {
  const parameters = {};
  for (const parameterKey of parameterKeys) {
    const intrinsicFunctionKey = `${resourceType}:${parameterKey}`;
    const funcResponse = intrinsicFunctionsMap.get(intrinsicFunctionKey);
    funcResponse.func.splice(1, 0, resourceName);
    parameters[parameterKey] = {};
    const func = funcResponse.func.shift();
    parameters[parameterKey][func] =
      funcResponse.func.length === 1 ? funcResponse.func[0] : funcResponse.func;
  }
  return parameters;
}

function handleSAMResources(resource) {
  if (resource.startsWith("[AWS::Serverless::Function")) return "lambda";
  if (resource.startsWith("[AWS::Serverless::SimpleTable")) return "dynamodb";

  return resource.split("::")[1].toLowerCase();
}
