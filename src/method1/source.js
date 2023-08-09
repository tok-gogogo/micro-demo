import { CompletionPath, fetchSource } from "../common/utils";
import scopedCSS from "../scope/scopedcss";
// import scopedCSS2 from "../scope/scopedcss_string";

export default function loadHtml(app) {
  fetchSource(app.url)
    .then((html) => {
      html = html
        .replace(/<head[^>]*>[\s\S]*?<\/head>/i, (match) => {
          return match
            .replace(/<head/i, "<micro-demo-head")
            .replace(/<\/head>/i, "</micro-demo-head>");
        })
        .replace(/<body[^>]*>[\s\S]*?<\/body>/i, (match) => {
          return match
            .replace(/<body/i, "<micro-demo-body")
            .replace(/<\/body>/i, "</micro-demo-body>");
        });
      // 将html字符串转化为DOM结构
      const htmlDom = document.createElement("div");
      htmlDom.innerHTML = html;
      // console.log("html:", htmlDom);

      // 进一步提取和处理js、css等静态资源
      extractSourceDom(htmlDom, app);

      // console.log(app.source.links, app.source.scripts);

      // 如果有远程css资源，则通过fetch请求
      if (app.source.links.length) {
        fetchLinksFromHtml(app, htmlDom);
      } else {
        app.onLoad(htmlDom);
      }

      // 如果有远程js资源，则通过fetch请求
      if (app.source.scripts.length) {
        fetchScriptsFromHtml(app, htmlDom);
      } else {
        app.onLoad(htmlDom);
      }
    })
    .catch((e) => {
      console.error("加载html出错", e);
    });
}

/**
 * 递归处理每一个子元素
 * @param parent 父元素
 * @param app 应用实例
 */
function extractSourceDom(parent, app) {
  const children = Array.from(parent.children);

  // 递归每一个子元素
  children.length &&
    children.forEach((child) => {
      extractSourceDom(child, app);
    });

  for (const dom of children) {
    if (dom instanceof HTMLLinkElement) {
      // 提取css地址
      const href = dom.getAttribute("href");
      if (dom.getAttribute("rel") === "stylesheet" && href) {
        app.source.links.push({
          url: href,
        });
      }
      // 删除原有元素
      parent.removeChild(dom);
    } else if (dom instanceof HTMLStyleElement) {
      const styleCode = dom.textContent;
      app.source.links.push({
        code: styleCode,
      });
      parent.removeChild(dom);

    } else if (dom instanceof HTMLScriptElement) {
      // 并提取js地址
      const src = dom.getAttribute("src");
      if (src) {
        // 远程script
        app.source.scripts.push({
          url: CompletionPath(src,app.url),
        });
      } else if (dom.textContent) {
        // 内联script
        app.source.scripts.push({
          code: dom.textContent, // 代码内容
        });
      }
      parent.removeChild(dom);
    }
  }
}

/**
 * 获取link远程资源
 * @param app 应用实例
 * @param htmlDom html DOM结构
 */
export function fetchLinksFromHtml(app, htmlDom) {
  // 通过fetch请求所有css资源
  const fetchLinkPromise = [];
  for (const item of app.source.links) {
    const { url, code } = item;
    fetchLinkPromise.push(code ? Promise.resolve(code) : fetchSource(url));
  }
  const links = [];
  Promise.all(fetchLinkPromise)
    .then((res) => {
      for (let i = 0; i < res.length; i++) {
        // let parseCode =  scopedCSS(res[i],app.name);
        // let parseCode =  scopedCSS2(res[i],app);

        
        let parseCode =  res[i];

        links.push(parseCode);
      }
      app.source.links = links;
      // 处理完成后执行onLoad方法
      app.onLoad(htmlDom);
    })
    .catch((e) => {
      console.error("加载css出错", e);
    });
}

/**
 * 获取js远程资源
 * @param app 应用实例
 * @param htmlDom html DOM结构
 */
export function fetchScriptsFromHtml(app, htmlDom) {
  // 通过fetch请求所有js资源
  const fetchScriptPromise = [];
  for (const item of app.source.scripts) {
    const { url, code } = item;
    fetchScriptPromise.push(code ? Promise.resolve(code) : fetchSource(url));
  }

  let scripts = [];
  Promise.all(fetchScriptPromise)
    .then((res) => {
      for (let i = 0; i < res.length; i++) {
        scripts.push(res[i]);
      }
      app.source.scripts = scripts;
      app.onLoad(htmlDom);
    })
    .catch((e) => {
      console.error("加载js出错", e);
    });
}
