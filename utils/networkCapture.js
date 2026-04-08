const fs = require('fs');
const path = require('path');

function isDefaultApiCall(url) {
  return (
    !url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map)(\?|$)/) &&
    !url.includes('google-analytics') &&
    !url.includes('intercom') &&
    !url.includes('hotjar') &&
    !url.includes('segment')
  );
}

function createNetworkCapture(page, options = {}) {
  const {
    filter = isDefaultApiCall,
    textBodyLimit = 800,
  } = options;

  const entries = [];

  const requestHandler = (req) => {
    if (!filter(req.url(), req)) return;

    entries.push({
      dir: 'REQ',
      method: req.method(),
      url: req.url(),
      postData: req.postData() || null,
    });
  };

  const responseHandler = async (res) => {
    if (!filter(res.url(), res.request())) return;

    let body = null;
    try {
      body = await res.json();
    } catch {
      try {
        body = (await res.text()).slice(0, textBodyLimit);
      } catch {
        body = null;
      }
    }

    entries.push({
      dir: 'RES',
      method: res.request().method(),
      url: res.url(),
      status: res.status(),
      body,
    });
  };

  return {
    start() {
      page.on('request', requestHandler);
      page.on('response', responseHandler);
    },

    stop() {
      page.removeListener('request', requestHandler);
      page.removeListener('response', responseHandler);
      return [...entries];
    },

    getEntries() {
      return [...entries];
    },

    clear() {
      entries.length = 0;
    },
  };
}

async function withNetworkCapture(page, fn, options = {}) {
  const capture = createNetworkCapture(page, options);
  capture.start();

  try {
    await fn();
  } finally {
    capture.stop();
  }

  return capture.getEntries();
}

function saveNetworkCapture(filePath, key, entries) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  let data = {};
  if (fs.existsSync(filePath)) {
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      data = {};
    }
  }

  data[key] = entries;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = {
  createNetworkCapture,
  withNetworkCapture,
  saveNetworkCapture,
  isDefaultApiCall,
};
