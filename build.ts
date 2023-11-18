import path from "node:path";
import process from "node:process";
import fs from "node:fs";
import { Transform, TransformCallback } from 'stream'

// フォルダやファイルは環境に合わせて書き換えてください
// 作業フォルダの指定
const projectBaseDir = process.cwd();

// ビルド対象のtsファイルを指定
const input_bun = path.resolve(
  projectBaseDir,
  "lambda/index_bun.ts"
);

// ビルド後の*.jsファイルの出力先＆拡張子を指定
const output = path.resolve(projectBaseDir, "dist");
const ext = "mjs";

// bunのbuild設定
await Bun.build({
  entrypoints: [input_bun],
  outdir: output,
  target: "bun",
  format: "esm",
  naming: `[dir]/[name].${ext}`
});

// "import.meta.require" error 対応をするjsファイル一覧
const pathToBuildedFileBun = path.resolve(projectBaseDir, `dist/index_bun.${ext}`);
const files = [pathToBuildedFileBun]

for (const file of files) {
  const inputFile = fs.createReadStream(file, {
    encoding: "utf-8"
  });
  const outputFile = fs.createWriteStream(`${file}.bak`, {
    encoding: "utf-8"
  });

  // jsファイルの先頭に"import.meta.require" error 対応コードを追加する。
  // stream形式で書き込んでいるのは、jsファイルのサイズが大きいとこの処理が落ちるため
  outputFile.write('import { createRequire as createImportMetaRequire } from "module"; import.meta.require ||= (id) => createImportMetaRequire(import.meta.url)(id);\n\n')

  const decoder = new TextDecoder();
  const transformer = new Transform({
    transform(
      chunk: Uint8Array, 
      encoding: string, 
      done: TransformCallback
    ): void {
      let chunkString = decoder.decode(chunk);
      
      this.push(chunkString)
      done()
    },
  })

  inputFile.pipe(transformer).pipe(outputFile);
  
  fs.unlinkSync(file);
  fs.renameSync(`${file}.bak`, file);
}
