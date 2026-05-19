import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BookLock, X } from "lucide-react";
import { useStoryEngine } from "../hooks/useStoryEngine";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedLegalTerms, setAcceptedLegalTerms] = useState(false);
  const [acceptedPersonalInfoProcessing, setAcceptedPersonalInfoProcessing] = useState(false);
  const [legalDialogOpen, setLegalDialogOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  
  const { login, register, setPassword: setUserPassword, unlockAudioContext } = useStoryEngine();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    unlockAudioContext();
    if (!phone || phone.length !== 11) {
      setErrorMsg("请输入11位手机号");
      return;
    }
    if (!isLogin && !name) {
      setErrorMsg("请输入您的姓名");
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg("密码至少需要 6 位");
      return;
    }
    if ((!isLogin || needsPasswordSetup) && password !== confirmPassword) {
      setErrorMsg("两次输入的密码不一致");
      return;
    }
    if (!acceptedLegalTerms || !acceptedPersonalInfoProcessing) {
      window.alert("请先勾选协议后继续\n\n为了保护您和家人的信息安全，使用前需要先阅读并同意相关协议。");
      return;
    }

    const consent = {
      acceptedLegalTerms,
      acceptedPersonalInfoProcessing,
    };
    
    setIsLoading(true);
    setErrorMsg("");
    
    let result;
    if (needsPasswordSetup) {
      result = await setUserPassword(phone, password, consent);
    } else if (isLogin) {
      result = await login(phone, password, consent);
    } else {
      result = await register(phone, name, age, password, consent);
    }
    
    setIsLoading(false);
    if (result.success) {
      navigate({ to: "/mic-setup" });
    } else if (result.needSetPassword) {
      setNeedsPasswordSetup(true);
      setPassword("");
      setConfirmPassword("");
      setErrorMsg(result.message || "请先设置登录密码");
    } else {
      setErrorMsg(result.message || "操作失败，请重试");
    }
  };

  const inputCls =
    "bg-stone-900/50 text-amber-100 text-xl w-full p-4 rounded-xl mb-4 focus:ring-2 focus:ring-amber-500 outline-none placeholder:text-amber-200/40 border border-stone-700";

  const switchMode = () => {
    setIsLogin(!isLogin);
    setNeedsPasswordSetup(false);
    setPassword("");
    setConfirmPassword("");
    setErrorMsg("");
  };

  const checkboxCls = "mt-1 h-5 w-5 shrink-0 rounded border-amber-200 accent-amber-500";
  const agreementTextCls = "text-sm leading-relaxed text-amber-100/85";

  const submitLabel = needsPasswordSetup
    ? "设置密码并进入"
    : isLogin
      ? "翻开我的故事"
      : "登记并开启我的故事";

  return (
    <main
      className="min-h-screen w-full flex items-center justify-center p-6"
      style={{
        backgroundColor: "#fde9c4",
        backgroundImage:
          "radial-gradient(circle at 20% 30%, rgba(180,120,60,0.15), transparent 60%), radial-gradient(circle at 80% 70%, rgba(140,80,30,0.18), transparent 55%)",
      }}
    >
      <div className="w-full max-w-md bg-stone-800 rounded-r-3xl rounded-l-md shadow-2xl p-8 relative border-l-8 border-stone-900">
        {/* Decorative corner */}
        <div className="absolute top-6 right-6 opacity-30">
          <BookLock className="h-10 w-10 text-amber-300" />
        </div>

        {/* Title */}
        <h1
          className="text-5xl text-amber-400 font-serif mb-2"
          style={{ fontFamily: "'Noto Serif SC', serif" }}
        >
          故事坊
        </h1>
        <p className="text-xl text-amber-200/80 mb-8">
          {needsPasswordSetup ? "请先设置登录密码" : "AI 家庭记忆传承"}
        </p>

        {errorMsg && (
          <p className="text-red-400 text-center mb-4 bg-red-900/20 p-2 rounded-lg animate-pulse">
            {errorMsg}
          </p>
        )}

        <div className="my-6 h-px bg-amber-700/40" />

        <form onSubmit={handleSubmit}>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={11}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            placeholder="请输入您的手机号"
            className={inputCls}
            disabled={isLoading}
          />

          {!isLogin && !needsPasswordSetup && (
            <>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="您的姓名 (如：李建国)"
                className={inputCls}
                disabled={isLoading}
              />
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="您的年龄 (选填)"
                className={inputCls}
                disabled={isLoading}
              />
            </>
          )}

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={needsPasswordSetup ? "请设置登录密码（至少6位）" : "请输入密码"}
            className={inputCls}
            disabled={isLoading}
            autoComplete={isLogin && !needsPasswordSetup ? "current-password" : "new-password"}
          />

          {(!isLogin || needsPasswordSetup) && (
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入密码"
              className={inputCls}
              disabled={isLoading}
              autoComplete="new-password"
            />
          )}

          <div className="mb-5 space-y-3 rounded-xl bg-stone-900/35 p-4 ring-1 ring-amber-100/10">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={acceptedLegalTerms}
                onChange={(e) => setAcceptedLegalTerms(e.target.checked)}
                className={checkboxCls}
                disabled={isLoading}
              />
              <span className={agreementTextCls}>
                我已阅读并同意
                <button
                  type="button"
                  onClick={() => setLegalDialogOpen(true)}
                  className="mx-1 font-semibold text-amber-300 underline underline-offset-4"
                >
                  《用户服务协议》《隐私政策》《AI 生成内容说明与免责声明》
                </button>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={acceptedPersonalInfoProcessing}
                onChange={(e) => setAcceptedPersonalInfoProcessing(e.target.checked)}
                className={checkboxCls}
                disabled={isLoading}
              />
              <span className={agreementTextCls}>
                我同意平台为生成回忆录而处理我的语音、文字、家庭故事等个人信息。
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="bg-amber-600 text-white text-2xl font-bold w-full py-4 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all mt-2 disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
          >
            {isLoading ? "处理中..." : submitLabel}
          </button>
        </form>

        {!needsPasswordSetup && (
          <p
            onClick={switchMode}
            className="text-stone-400 text-center mt-6 cursor-pointer hover:text-amber-300 text-lg transition-colors"
          >
            {isLogin ? "第一次使用？点击这里登记" : "已有专属日记本？返回开锁"}
          </p>
        )}
      </div>

      {legalDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-5">
          <div className="max-h-[86vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-amber-50 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-amber-200 p-5">
              <div>
                <h2 className="text-2xl font-black text-stone-900">使用前说明</h2>
                <p className="mt-1 text-base text-stone-600">请阅读以下内容后再勾选同意。</p>
              </div>
              <button
                type="button"
                onClick={() => setLegalDialogOpen(false)}
                className="rounded-full bg-white p-2 text-stone-500 shadow-sm hover:bg-amber-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[62vh] space-y-4 overflow-y-auto p-5 text-base leading-relaxed text-stone-700">
              <p>
                本产品用于辅助用户记录、整理和生成个人回忆录内容，提供语音识别、AI 问答、文字整理和回忆录生成等功能，不构成法律、医疗、心理咨询、财务或其他专业建议。
              </p>
              <p>
                AI 生成内容可能存在理解偏差、表述不准确、遗漏或不符合真实意图的情况。用户应自行核对、修改并确认最终内容。
              </p>
              <p>
                用户讲述家庭成员、亲友或其他第三方故事时，可能涉及他人个人信息或隐私。请在合理范围内取得相关人员同意，或避免提供可能损害他人权益的敏感内容。
              </p>
              <p>
                为实现产品功能，平台可能处理手机号、姓名、年龄、语音内容、转写文本、对话记录、回忆录内容、使用记录和个性化设置。
              </p>
              <p>
                回忆过往经历可能引发情绪波动。本产品仅提供陪伴式记录和整理服务，如用户明显不适，应暂停使用并寻求家人、照护者或专业人士帮助。
              </p>
              <p>
                用户可以申请查看、更正或删除其个人信息和内容。因法律法规、系统安全或审计需要，部分备份或日志可能在合理期限内保留。
              </p>
            </div>

            <div className="border-t border-amber-200 p-5">
              <button
                type="button"
                onClick={() => setLegalDialogOpen(false)}
                className="w-full rounded-xl bg-stone-800 py-3 text-xl font-bold text-amber-50 shadow-md"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
