// flow-typed signature: 04f45fad272bbac7e89d130f26598ee4
// flow-typed version: c6154227d1/file-saver_v2.x.x/flow_>=v0.104.x

declare function saveAs(
  data: Blob | File | string,
  filename?: string,
  options?: {| autoBom: boolean |}
): void;

declare module "file-saver" {
  declare module.exports: {
    [[call]]: typeof saveAs,
    saveAs: typeof saveAs,
    ...
  };
}
