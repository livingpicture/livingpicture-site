// netlify/functions/payplus-callback.js
const FUNC_VERSION = "payplus-callback@2026-01-14-1";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "X-Func-Version": FUNC_VERSION,
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  try {
    const qp = event.queryStringParameters || {};

    console.log("✅ PayPlus CALLBACK HIT");
    console.log("method:", event.httpMethod);
    console.log("path:", event.path);
    console.log("query:", qp);

    return json(200, {
      ok: true,
      message: "Callback received",
      received: qp,
      debug: { version: FUNC_VERSION },
    });
  } catch (err) {
    console.error("❌ Callback error:", err);
    return json(500, { ok: false, error: "Internal error", debug: { version: FUNC_VERSION } });
  }
};
