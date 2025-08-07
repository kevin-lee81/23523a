// src/index.js

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. 루트 경로("/")로 GET 요청이 오면 index.html 파일을 보여줍니다.
    if (url.pathname === "/" && request.method === "GET") {
      // 이 부분은 Cloudflare Pages를 사용하면 자동으로 처리되지만,
      // Worker만으로 배포할 경우 명시적으로 HTML을 반환해야 합니다.
      // 하지만 보통은 Pages에 HTML을 올리고 Worker는 API 역할만 하도록 분리합니다.
      // 지금은 하나의 Worker로 두 가지를 다 처리하는 간단한 방법을 사용합니다.
      // 참고: 이 방법으로 HTML을 제공하려면 wrangler.toml에 [site] 설정을 추가해야 합니다.
      // 더 쉬운 방법은 3단계에서 설명하겠습니다. 지금은 API 부분에 집중합니다.
      return new Response("HTML은 Cloudflare Pages에 배포하는 것이 가장 좋습니다. /upload 엔드포인트를 사용해주세요.", {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // 2. "/upload" 경로로 POST 요청이 오면 주문을 처리합니다.
    if (url.pathname === "/upload" && request.method === "POST") {
      try {
        // multipart/form-data 형식의 요청을 파싱합니다.
        const formData = await request.formData();
        const file = formData.get("file");
        const orderDataString = formData.get("orderData");
        const orderData = JSON.parse(orderDataString);

        if (!file || !orderData) {
          return new Response(JSON.stringify({ error: "필수 데이터가 누락되었습니다." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        // --- R2에 파일 업로드 ---
        // 파일 이름을 고유하게 만듭니다. (타임스탬프-연락처-원본파일명)
        const timestamp = new Date().toISOString();
        const uniqueFileName = `${timestamp}-${orderData.contact}-${file.name}`;

        await env.ORDER_BUCKET.put(uniqueFileName, file.stream(), {
          httpMetadata: { contentType: file.type },
        });

        // --- 구글 시트에 데이터 전송 ---
        const sheetData = {
          timestamp: timestamp,
          size: orderData.size,
          material: orderData.material,
          quantity: orderData.quantity,
          workOption: orderData.workOption,
          color: orderData.color,
          contact: orderData.contact,
          email: orderData.email,
          specialRequest: orderData.specialRequest,
          address: orderData.address,
          totalPrice: orderData.totalPrice,
          fileName: uniqueFileName, // R2에 저장된 파일명
        };

        const googleSheetsUrl = env.GOOGLE_SHEETS_URL;
        if (googleSheetsUrl) {
          await fetch(googleSheetsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: sheetData }),
          });
        }
        
        // 성공 응답 반환
        return new Response(JSON.stringify({ success: true, message: "주문이 성공적으로 처리되었습니다." }), {
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*' // 모든 출처에서의 요청 허용 (개발용)
          },
        });

      } catch (e) {
        console.error("주문 처리 오류:", e);
        return new Response(JSON.stringify({ error: "서버 내부 오류: " + e.message }), { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        });
      }
    }

    // 그 외의 모든 요청은 404 Not Found 처리
    return new Response("요청한 페이지를 찾을 수 없습니다.", { status: 404 });
  },
};
