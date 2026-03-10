export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,x-api-key"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      const authorized = request.headers.get("x-api-key") === env.API_KEY;
      return json({ ok: authorized }, authorized ? 200 : 401, corsHeaders);
    }

    if (url.pathname !== "/send" || request.method !== "POST") {
      return json({ ok: false, error: "Ruta no encontrada" }, 404, corsHeaders);
    }

    if (request.headers.get("x-api-key") !== env.API_KEY) {
      return json({ ok: false, error: "No autorizado" }, 401, corsHeaders);
    }

    const body = await request.json();
    const telefono = String(body.telefono || "").replace(/\D/g, "");
    const mensaje = String(body.mensaje || "").trim();

    if (!telefono || !mensaje) {
      return json({ ok: false, error: "Faltan datos" }, 400, corsHeaders);
    }

    const metaUrl = `https://graph.facebook.com/v23.0/${env.PHONE_NUMBER_ID}/messages`;
    const response = await fetch(metaUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: telefono,
        type: "text",
        text: { body: mensaje }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return json({ ok: false, error: data.error?.message || "Error de WhatsApp" }, 500, corsHeaders);
    }

    return json({ ok: true, data }, 200, corsHeaders);
  }
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders
    }
  });
}
