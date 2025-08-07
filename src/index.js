export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/upload" && request.method === "POST") {
      try {
        const formData = await request.formData();
        const file = formData.get("file");
        const orderDataString = formData.get("orderData");
        if (!file || !orderDataString) {
          return new Response(JSON.stringify({error: "파일 또는 주문 데이터가 없습니다."}), {status: 400, headers: {'Content-Type': 'application/json'}});
        }

        const orderData = JSON.parse(orderDataString);
        const timestamp = new Date().toISOString();
        const uniqueFileName = `${timestamp}-${orderData.contact}-${file.name}`;

        // R2에 파일 저장
        await env.ORDER_BUCKET.put(uniqueFileName, file.stream(), {
          httpMetadata: { contentType: file.type }
        });

        // 구글 시트로 데이터 전송
        const sheetData = {
          timestamp,
          size: orderData.size,
          material: orderData.material,
          quantity: orderData.quantity,
          contact: orderData.contact,
          email: orderData.email,
          fileName: uniqueFileName,
        };

        await fetch(env.GOOGLE_SHEETS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: sheetData }),
        });

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
