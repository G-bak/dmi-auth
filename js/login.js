/* =========================================================================
   /static/js/login.js
   로그인 처리 스크립트 (async/await + Bootstrap alert 스타일)
   - 서버 에러 응답(JSON)의 다양한 형태(detail: string/array/object, message, error)를
     보기 좋게 문자열로 뽑아 보여줍니다.
   - 401/400/422/429 등 상태코드별 기본 메시지도 커버합니다.
   ========================================================================== */

"use strict";

/* ---------- 유틸 ---------- */
function $(sel, root) { return (root || document).querySelector(sel); }

/** 에러 메시지 추출기: FastAPI/일반 API 모두 대응 */
function extractErrorMessage(res, body) {
  // 1) 공통 필드
  if (typeof body?.message === "string") return body.message;
  if (typeof body?.error === "string")   return body.error;

  // 2) FastAPI 스타일(detail)
  const d = body?.detail;
  if (typeof d === "string") return d;

  if (Array.isArray(d)) {
    // 보통 [{loc:[...], msg:"...", type:"..."}] 형태
    const msgs = d.map(x => x?.msg || x?.message || "").filter(Boolean);
    if (msgs.length) return msgs.join("\n");
    return JSON.stringify(d);
  }

  if (d && typeof d === "object") {
    return d.msg || d.message || JSON.stringify(d);
  }

  // 3) 상태코드별 기본 문구
  if (res.status === 401) return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (res.status === 400) return "요청 형식이 올바르지 않습니다.";
  if (res.status === 422) return "입력값을 확인하세요.";
  if (res.status === 429) return "요청이 너무 많습니다. 잠시 후 다시 시도하세요.";

  return "알 수 없는 오류가 발생했습니다.";
}

/** 상단 알림 표시 */
function showMsg(text, type) {
  let box = $("#formAlert");
  if (!box) {
    const wrap = document.createElement("div");
    wrap.id = "formAlert";
    wrap.className = "alert mt-3 alert-dismissible fade show shadow-sm";
    wrap.style.fontWeight = "500";
    wrap.style.borderLeft = "5px solid transparent";
    wrap.style.padding = "3px 0";

    // 버튼 행(row) 위에 메시지 표시
    const row = document.getElementById("row");
    (row?.parentElement || document.body).insertBefore(wrap, row || null);
    box = wrap;
  }

  const typeMap = {
    success: { cls: "alert-success", icon: "✅", border: "#198754" },
    danger:  { cls: "alert-danger",  icon: "❌", border: "#dc3545" },
    warning: { cls: "alert-warning", icon: "⚠️", border: "#ffc107" },
    info:    { cls: "alert-info",    icon: "ℹ️", border: "#0dcaf0" }
  };
  const conf = typeMap[type] || typeMap.info;

  box.className = `alert mt-3 alert-dismissible fade show shadow-sm ${conf.cls}`;
  box.style.borderLeft = `5px solid ${conf.border}`;
  box.innerHTML = `
    <span style="margin: 0 5px;">${conf.icon}</span>
    <span style="font-size: 14px; color: #000 !important;">${text || ""}</span>
  `;
  box.hidden = !text;
}

/* ---------- 메인 ---------- */
const form = document.querySelector(".card-body form");
if (form) {
  const emailInput = form.querySelector('input[type="email"]');
  const pwInput    = form.querySelector('input[type="password"]');
  const remember   = form.querySelector("#rememberMe");
  const submitBtn  = form.querySelector('button[type="submit"]');

  /** 클라이언트단 간단 검증 */
  const validate = () => {
    const email = (emailInput?.value || "").trim();
    const pw = pwInput?.value || "";
    if (!email) return { ok:false, msg:"이메일을 입력하세요." };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok:false, msg:"올바른 이메일 형식이 아닙니다." };
    if (!pw) return { ok:false, msg:"비밀번호를 입력하세요." };
    return { ok:true, data:{ email, password: pw, remember_me: !!remember?.checked } };
  };

  /** 로그인 요청 */
  const login = async (payload) => {
    const res = await fetch("/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      credentials: "include",        // httpOnly 쿠키 사용 시 필수
      body: JSON.stringify(payload)
    });

    let body = {};
    try { body = await res.json(); } catch (_) {}

    if (!res.ok) {
      const msg = extractErrorMessage(res, body);
      throw { status: res.status, message: msg };
    }
    return body; // { access_token: ..., ... } 등
  };

  /** 제출 핸들러 */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMsg("", "info"); // 기존 메시지 리셋

    const v = validate();
    if (!v.ok) { showMsg(v.msg, "warning"); return; }

    // 버튼 잠금 & 로딩 텍스트
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.originalText = submitBtn.textContent || "";
      submitBtn.textContent = "로그인 중...";
    }

    try {
      await login(v.data);
      showMsg("로그인 되었습니다. 이동합니다…", "success");

      // URLSearchParams로 next 파라미터 읽기
      const params = new URLSearchParams(window.location.search);
      let next = params.get("next");

      // 따옴표(%22)나 쌍따옴표가 붙은 경우만 정리
      try { next = decodeURIComponent(next); } catch {}
      next = next.replace(/^['"]|['"]$/g, "");

      // 그대로 리다이렉트
      setTimeout(() => { window.location.href = next; }, 500);
    } catch (err) {
      if (err?.message) {
        if (err?.status === 401 || err?.status === 400) {
            showMsg("이메일 또는 비밀번호가 올바르지 않습니다.", "danger");
          } else if (err?.status === 429) {
            showMsg("요청이 너무 많습니다. 잠시 후 다시 시도하세요.", "warning");
          } else {
          showMsg("현재는 정적 페이지만 배포된 환경입니다.", "danger");
        }
      } else {
        showMsg(err.message, "danger");
      }
      // UX: 비밀번호 필드 포커스
      pwInput?.focus();
      pwInput?.select?.();
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.dataset.originalText || "Login";
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const linkRegister = document.getElementById("linkRegister");
  console.log(linkRegister);
  if (!linkRegister) return;

  const params = new URLSearchParams(window.location.search);
  let next = params.get("next");
  console.log(next);

  if (!next) return; // next가 없으면 기본 /register 유지

  // 로그인 로직과 동일: decode 및 양끝 따옴표 제거
  try { next = decodeURIComponent(next); } catch {}
  next = String(next).replace(/^['"]|['"]$/g, "");

  // /register?next=... 로 재설정
  const dest = "/register?next=" + encodeURIComponent(next);
  linkRegister.setAttribute("href", dest);
  console.log("[login.js] register link updated:", dest);
});
