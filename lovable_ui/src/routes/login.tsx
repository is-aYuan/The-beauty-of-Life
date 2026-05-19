import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BookLock } from "lucide-react";
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
    
    setIsLoading(true);
    setErrorMsg("");
    
    let result;
    if (needsPasswordSetup) {
      result = await setUserPassword(phone, password);
    } else if (isLogin) {
      result = await login(phone, password);
    } else {
      result = await register(phone, name, age, password);
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
    </main>
  );
}
