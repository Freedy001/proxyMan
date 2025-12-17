/**
 * Monaco Editor 按需加载配置
 * 只加载项目实际需要的语言和功能，大幅减少包体积
 */
import * as monaco from 'monaco-editor';

// 只导入需要的语言支持 (根据 ProxyMan 项目需求)
import 'monaco-editor/esm/vs/language/json/monaco.contribution';
import 'monaco-editor/esm/vs/language/html/monaco.contribution';
import 'monaco-editor/esm/vs/language/css/monaco.contribution';
import 'monaco-editor/esm/vs/language/typescript/monaco.contribution';

// 导入基础语言（轻量级，不包含复杂语言服务）
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution';
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution';

// Worker 配置 - 按需加载各语言的 Web Worker
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
// import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
// import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
// import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

// 配置 Monaco Environment
self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') {
      return new jsonWorker();
    }
    // if (label === 'css' || label === 'scss' || label === 'less') {
    //   return new cssWorker();
    // }
    // if (label === 'html' || label === 'handlebars' || label === 'razor') {
    //   return new htmlWorker();
    // }
    // if (label === 'typescript' || label === 'javascript') {
    //   return new tsWorker();
    // }
    // 默认返回通用的 editor worker (用于其他语言的基础高亮)
    return new editorWorker();
  },
};

// 导出配置好的 monaco 对象
export default monaco;
