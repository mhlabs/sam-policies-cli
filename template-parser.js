function getFormattedResourceList(template) {
  return Object.keys(template.Resources)
    .map(p => {
      return `[${template.Resources[p].Type}] ${p}`;
    })
    .sort();
}

function getLambdaFunctions(template) {
  return Object.keys(template.Resources)
    .filter(p => template.Resources[p].Type === "AWS::Serverless::Function")
    .sort();
}

module.exports = {
  getFormattedResourceList,
  getLambdaFunctions
};
