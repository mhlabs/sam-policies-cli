const inquirer = require("inquirer");
const prompt = inquirer.createPromptModule();
const intrinsicFunctionsMap = require("./intrinsicFunctionMap");

const NOT_TEMPLATED = "Not templated";
async function selectResource(resources) {
  return (
    await prompt({
      name: "id",
      type: "list",
      message: `Select resource to grant access to`,
      choices: [...resources, NOT_TEMPLATED]
    })
  ).id;
}

async function getFreeText(resourceNameIdentifier) {
  return (
    await prompt({
      name: "id",
      type: "text",
      message: `Enter name or wildcard (*) for parameter [${resourceNameIdentifier}]`
    })
  ).id;
}

async function selectPolicyTemplate(availableTemplates, resourceType) {
  return (await prompt({
    name: "id",
    type: "list",
    message: `Select policy template`,
    choices: [
      ...availableTemplates,
      ...intrinsicFunctionsMap.getRelatedServices(resourceType),      
    ]
  })).id;
}

async function selectLambdaFunction(lambdas) {
  return (await prompt({
    name: "id",
    type: "list",
    message: `Select function to apply policy on`,
    choices: lambdas
  })).id;
}

module.exports = {
  selectResource,
  selectPolicyTemplate,
  selectLambdaFunction,
  NOT_TEMPLATED,
  getFreeText
};
