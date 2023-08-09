function iframeGenerator(sandbox) {
  const url = "http://localhost:9001/test/index.html";
  const iframe = document.createElement("iframe");

  // 设置 iframe 的属性
  iframe.src = url;
  window.document.body.appendChild(iframe);
  const iframeWindow = iframe.contentWindow;
  // 变量需要提前注入，在入口函数通过变量防止死循环
  iframeWindow.__MICRO_DEMO_FLAG = "micro-demo";
  sandbox.iframeReady = stopIframeLoading(iframeWindow).then(() => {
    if (!iframeWindow.__MICRO_DEMO_FLAG) {
      iframeWindow.__MICRO_DEMO_FLAG = "micro-demo";
    }
  });
  return iframeWindow;
}

function stopIframeLoading(iframeWindow) {
  const oldDoc = iframeWindow.document;
  return new Promise((resolve) => {
    function loop() {
      setTimeout(() => {
        let newDoc = null;
        try {
          newDoc = iframeWindow.document;
        } catch (err) {
          newDoc = null;
        }
        // wait for document ready
        if (!newDoc || newDoc == oldDoc) {
          loop();
        } else {
          iframeWindow.stop
            ? iframeWindow.stop()
            : iframeWindow.document.execCommand("Stop");
            console.log('gg resolve');
          resolve();
        }
      }, 1);
    }
    loop();
  });
}

let obj = {};
const iframeWindow = iframeGenerator(obj);

setTimeout(() => {
  (async function () {
    console.log("================================");
    // iframeWindow.bb = "213";
  
    await obj.iframeReady;
    console.log("================================2");
  })();
  
}, 8000);
