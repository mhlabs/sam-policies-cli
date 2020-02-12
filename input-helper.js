const inquirer = require("inquirer");
const prompt = inquirer.createPromptModule();
const intrinsicFunctionsMap = require("./intrinsicFunctionMap");

async function selectResource(resources) {
  return (
    await prompt({
      name: "id",
      type: "list",
      message: `Select resource`,
      choices: resources
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
      ...intrinsicFunctionsMap.getRelatedServices(resourceType)
    ]
  })).id;
}

async function selectLambdaFunction(lambdas) {
  return (await prompt({
    name: "id",
    type: "list",
    message: `Select function to apply policy to`,
    choices: lambdas
  })).id;
}

module.exports = {
  selectResource,
  selectPolicyTemplate,
  selectLambdaFunction
};
