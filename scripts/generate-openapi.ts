const openapi = await Bun.file("docs/openapi/openapi.yaml").text();
console.log(openapi);

export {};
