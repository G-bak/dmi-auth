/*
    /static/js/register.js
    회원가입 처리 스크립트 (async/await 버전)
*/

// ====== DOM helper ======
function $(sel, root) { return (root || document).querySelector(sel); }

function showMsg(text, type) {
  let box = $('#formAlert');
  if (!box) {
    const wrap = document.createElement('div');
    wrap.id = 'formAlert';
    wrap.className = 'alert mt-3 alert-dismissible fade show shadow-sm';
    wrap.style.fontWeight = "500";
    wrap.style.borderLeft = "5px solid transparent";
    wrap.style.padding = "3px 0";
    const row = document.getElementById("row");
    row.parentElement.insertBefore(wrap, row);
    box = wrap;
  }

  const typeMap = {
    success: { cls: 'alert-success', icon: '✅', border: '#198754' },
    danger:  { cls: 'alert-danger',  icon: '❌', border: '#dc3545' },
    warning: { cls: 'alert-warning', icon: '⚠️', border: '#ffc107' },
    info:    { cls: 'alert-info',    icon: 'ℹ️', border: '#0dcaf0' }
  };

  const conf = typeMap[type] || typeMap.info;

  box.className = `alert mt-3 alert-dismissible fade show shadow-sm ${conf.cls}`;
  box.style.borderLeft = `5px solid ${conf.border}`;
  box.innerHTML = `
    <span style="margin: 0 5px;">${conf.icon}</span><span style="font-size: 14px; color: #000 !important;">${text}</span>
  `;
  box.hidden = !text;
}

// 현재 URL의 next 파라미터(+ 동일 오리진 referrer fallback)를 안전하게 반환
function getSafeNext() {
  const params = new URLSearchParams(window.location.search);
  let next = params.get("next");

  // decode + 양끝 따옴표 제거
  try { next = decodeURIComponent(next); } catch {}
  next = String(next).replace(/^['"]|['"]$/g, "");

  return next;
}

// ====== 메인 로직 ======
const form = document.querySelector('.card-body form');
if (form) {
  const usernameInput = form.querySelector('input[name="username"]');
  const emailInput    = form.querySelector('input[name="email"]');
  const pwInput       = form.querySelector('input[name="password"]');
  const pw2Input      = form.querySelector('input[name="confirm"]');
  const agreeInput    = form.querySelector('#termsCheck');
  const submitBtn     = form.querySelector('button[type="submit"]');

  function validate() {
    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const pw = pwInput.value;
    const pw2 = pw2Input.value;

    if (!username) return { ok: false, msg: '사용자명을 입력하세요.' };
    if (!email) return { ok: false, msg: '이메일을 입력하세요.' };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, msg: '올바른 이메일 형식이 아닙니다.' };
    if (!pw || pw.length < 8) return { ok: false, msg: '비밀번호는 8자 이상 입력하세요.' };
    if (pw !== pw2) return { ok: false, msg: '비밀번호가 일치하지 않습니다.' };
    if (!agreeInput.checked) return { ok: false, msg: '약관에 동의해야 가입할 수 있습니다.' };

    return { ok: true, data: { username, email, password: pw } };
  }

  async function register(payload) {
    const res = await fetch('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    let body = {};
    try { body = await res.json(); } catch (_) {}

    if (!res.ok) {
      const msg =
        body?.message ||
        body?.detail ||
        body?.error ||
        '현재는 정적 페이지만 배포된 환경입니다.';
      throw { status: res.status, message: msg };
    }
    return body;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    showMsg('', 'info');

    const v = validate();
    if (!v.ok) { showMsg(v.msg, 'warning'); return; }

    submitBtn.disabled = true;
    submitBtn.dataset.originalText = submitBtn.textContent;
    submitBtn.textContent = '가입 처리 중...';

    try {
      await register(v.data);
      showMsg('가입이 완료되었습니다. 잠시 후 이동합니다.', 'success');
      setTimeout(() => {
        const safeNext = getSafeNext();
        console.log(safeNext);
        window.location.href = safeNext;
      }, 600);
    } catch (err) {
      showMsg(err?.message || '현재는 정적 페이지만 배포된 환경입니다.', 'danger');
      if (err?.status === 409) emailInput.focus();
      else if (err?.status === 422) usernameInput.focus();
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.dataset.originalText || 'Create Account';
    }
  });
}
