// Proxy support for the Anthropic SDK.
// Reads HTTPS_PROXY and NODE_EXTRA_CA_CERTS from environment,
// returns fetchOptions to pass into the Anthropic client constructor.

import { ProxyAgent } from "undici";
import fs from "fs";
import path from "path";
import os from "os";

function resolvePath(p) {
  return p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p;
}

export function getProxyOptions() {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!proxyUrl) return {};

  const caCertPath = process.env.NODE_EXTRA_CA_CERTS;
  const tlsOptions = {};
  if (caCertPath) {
    tlsOptions.ca = fs.readFileSync(resolvePath(caCertPath));
  }

  const agent = new ProxyAgent({
    uri: proxyUrl,
    ...(tlsOptions.ca && { requestTls: tlsOptions }),
  });

  return { fetchOptions: { dispatcher: agent } };
}
