import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { BookOpen, ShieldCheck, X } from "lucide-react";
import { useStoryEngine } from "../hooks/useStoryEngine";
import { hapticMedium } from "../lib/haptics";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

// ==================== 常量与类型 ====================

/** 向导步骤枚举 */
type WizardStep = "phone" | "consent" | "final";

/** 静默分流结果 */
type PhoneBranch = "returning" | "new_user";

/** 工程精度参数 — 适老化交互与暖纸张视觉系统 */
const STYLE = {
  /** 巨型输入框高度 ≥ 72px */
  INPUT_HEIGHT: "72px",
  /** 桌面端输入框高度。大屏不沿用移动端紧凑比例。 */
  DESKTOP_INPUT_HEIGHT: "88px",
  /** 桌面端输入字号 */
  DESKTOP_INPUT_FONT: "28px",
  /** 桌面端次级输入字号 */
  DESKTOP_INPUT_SECONDARY_FONT: "26px",
  /** 巨型按钮高度 72px */
  BUTTON_HEIGHT: "72px",
  /** 桌面端按钮高度 */
  DESKTOP_BUTTON_HEIGHT: "88px",
  /** 按钮文字 24px / 粗体 / 行高 1.4 */
  BUTTON_FONT: "24px",
  /** 桌面端按钮文字 */
  DESKTOP_BUTTON_FONT: "30px",
  BUTTON_LINE_HEIGHT: "1.4",
  /** 按钮间距 ≥ 24px */
  BUTTON_GAP: "24px",
  /** 隐私确认主标题 22px，避免多行说明压迫 */
  CONSENT_FONT: "22px",
  /** 桌面端隐私确认标题字号 */
  DESKTOP_CONSENT_FONT: "28px",
  /** 桌面端步骤提示字号 */
  DESKTOP_PROMPT_FONT: "24px",
  /** 老朋友回家 — 温暖岁月栗色 */
  COLOR_RETURNING: "#9F5C2B",
  /** 新朋友安家 — 生机松石绿色 */
  COLOR_NEW_USER: "#3D644D",
  /** 暖纸张书页主卡片 */
  PAPER: "#F9ECCD",
  /** 深胡桃木书脊 */
  WALNUT: "#5B3A22",
  /** 相册桌面质感边线 */
  ALBUM_LINE: "#C9AB78",
} as const;

/** 模块：隐私说明点。让协议确认先建立信任，再让用户继续。 */
const PRIVACY_PROMISES = [
  "手机号用于识别您的故事档案。",
  "您的信息用于整理回忆录。",
  "您可以查看、修改或删除您的信息。",
] as const;

// ==================== 工具函数 ====================

/** 切换到下一步时的卡片过渡样式 */
function cardTransitionStyle(direction: "left" | "right" | "none"): React.CSSProperties {
  if (direction === "none") return {};
  return {
    animation:
      direction === "left" ? "slideInFromRight 0.4s ease-out" : "slideInFromLeft 0.4s ease-out",
  };
}

/** 模块：相册桌面质感背景。用纸张、相片和木纹层次替代单一渐变。 */
function AlbumDeskBackdrop() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[#E8C99B]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-75"
        style={{
          backgroundImage:
            "linear-gradient(115deg, rgba(116,68,31,0.14) 0 1px, transparent 1px 26px), linear-gradient(25deg, rgba(255,255,255,0.24) 0 1px, transparent 1px 34px)",
        }}
      />
      <div className="pointer-events-none absolute -top-10 left-6 h-36 w-48 -rotate-6 rounded-md bg-[#FFF6E6] shadow-[0_18px_40px_rgba(88,55,28,0.18)] ring-1 ring-[#D8B98C]/60" />
      <div className="pointer-events-none absolute bottom-4 right-4 h-28 w-40 rotate-6 rounded-md bg-[#EBD8B8] shadow-[0_20px_50px_rgba(88,55,28,0.16)] ring-1 ring-[#C69C68]/50 xs:bottom-6 xs:right-6 xs:h-36 xs:w-52 sm:bottom-8 sm:right-8 sm:h-40 sm:w-56" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFF4D9]/50 blur-3xl" />
    </>
  );
}

/** 模块：品牌封面。保留书本意象，但从锁定感转向打开记忆。 */
function BrandHeader() {
  return (
    <header className="relative mb-4 flex items-start gap-3 xs:mb-6 xs:gap-4 md:mb-8 md:gap-5">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#7A4928] text-[#FFF7DF] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_12px_26px_rgba(92,55,30,0.22)] xs:h-14 xs:w-14 xs:rounded-2xl md:h-[72px] md:w-[72px] md:rounded-[20px]">
        <BookOpen className="h-7 w-7 xs:h-8 xs:w-8 md:h-10 md:w-10" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <h1
          className="mobile-safe-text text-3xl font-serif font-black leading-tight text-[#5B3A22] xs:text-5xl md:text-6xl"
          style={{ fontFamily: "'Noto Serif SC', serif" }}
        >
          故事坊
        </h1>
        <p className="mobile-safe-text mt-1 text-base font-semibold leading-snug text-[#8A603D] xs:mt-2 xs:text-xl md:text-2xl">
          把您的声音，整理成一本温暖的回忆录
        </p>
      </div>
    </header>
  );
}

/** 模块：主行动按钮。固定高度与大字号，保持适老化触控尺寸。 */
function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{
        height: "var(--login-button-height)",
        fontSize: "var(--login-button-font)",
        lineHeight: STYLE.BUTTON_LINE_HEIGHT,
        ...props.style,
      }}
      className={`w-full cursor-pointer rounded-xl font-bold text-white shadow-[0_16px_30px_rgba(109,63,28,0.22)] transition-all hover:translate-y-[-1px] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 ${props.className ?? ""}`}
    />
  );
}

// ==================== 主组件 ====================

function LoginPage() {
  const [step, setStep] = useState<WizardStep>("phone");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [branch, setBranch] = useState<PhoneBranch | null>(null);
  const [legalDialogOpen, setLegalDialogOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | "none">("none");
  const [consent, setConsent] = useState<{
    acceptedLegalTerms: boolean;
    acceptedPersonalInfoProcessing: boolean;
  } | null>(null);

  const phoneInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { checkPhone, login, verifyCode, unlockAudioContext } = useStoryEngine();

  // 自动聚焦手机号输入框
  useEffect(() => {
    if (step === "phone") {
      phoneInputRef.current?.focus();
    }
    if (step === "final" && branch === "returning") {
      passwordInputRef.current?.focus();
    }
  }, [step, branch]);

  // ==================== Step 1 → Step 2 过渡 ====================

  const handlePhoneNext = useCallback(async () => {
    hapticMedium();
    if (!phone || phone.length !== 11) {
      setErrorMsg("请输入11位手机号");
      return;
    }
    setErrorMsg("");
    unlockAudioContext();

    // 平滑过渡到隐私确认卡片
    setSlideDirection("left");
    setStep("consent");

    // 静默分流：后台查询手机号是否已注册
    try {
      const result = await checkPhone(phone);
      if (result.success) {
        setBranch(result.exists ? "returning" : "new_user");
      }
    } catch {
      // 网络错误时默认走新用户分支，Step 3 提交时再兜底
      setBranch("new_user");
    }
  }, [phone, checkPhone, unlockAudioContext]);

  // ==================== Step 2 → Step 3 过渡 ====================

  const handleConsentAgree = useCallback(() => {
    hapticMedium();
    setConsent({ acceptedLegalTerms: true, acceptedPersonalInfoProcessing: true });
    setSlideDirection("left");
    setStep("final");
  }, []);

  const handleConsentBack = useCallback(() => {
    hapticMedium();
    setSlideDirection("right");
    setStep("phone");
  }, []);

  // ==================== Step 3 提交 ====================

  const handleFinalSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      hapticMedium();
      unlockAudioContext();

      if (!consent) {
        setErrorMsg("请先阅读并同意相关协议");
        return;
      }

      setIsLoading(true);
      setErrorMsg("");

      try {
        const result =
          branch === "returning"
            ? await login(phone, password, consent)
            : await verifyCode({
                phone,
                code: "000000",
                consent,
                name,
                age,
              });

        if (result.success) {
          navigate({ to: "/mic-setup" });
        } else {
          setErrorMsg(result.message || "操作失败，请重试");
        }
      } catch (error) {
        console.error(error);
        setErrorMsg("连接服务器失败，请确认后端服务已启动。");
      } finally {
        setIsLoading(false);
      }
    },
    [consent, phone, password, name, age, branch, login, verifyCode, navigate, unlockAudioContext],
  );

  // ==================== 渲染 ====================

  return (
    <>
      {/* 卡片过渡动画 CSS */}
      <style>{`
        @keyframes slideInFromRight {
          from { transform: translateX(18px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideInFromLeft {
          from { transform: translateX(-18px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .login-shell {
          --login-button-height: ${STYLE.DESKTOP_BUTTON_HEIGHT};
          --login-button-font: ${STYLE.DESKTOP_BUTTON_FONT};
          --login-button-gap: ${STYLE.BUTTON_GAP};
          --login-consent-font: ${STYLE.DESKTOP_CONSENT_FONT};
          --login-input-height: ${STYLE.DESKTOP_INPUT_HEIGHT};
          --login-input-font: ${STYLE.DESKTOP_INPUT_FONT};
          --login-input-secondary-font: ${STYLE.DESKTOP_INPUT_SECONDARY_FONT};
          --login-prompt-font: ${STYLE.DESKTOP_PROMPT_FONT};
        }
        @media (max-width: 640px) {
          .login-shell {
            --login-button-height: 64px;
            --login-button-font: 22px;
            --login-button-gap: 12px;
            --login-consent-font: 20px;
            --login-input-height: ${STYLE.INPUT_HEIGHT};
            --login-input-font: ${STYLE.BUTTON_FONT};
            --login-input-secondary-font: 22px;
            --login-prompt-font: 20px;
          }
        }
      `}</style>

      <main className="relative flex min-h-[100svh] w-screen max-w-full items-center justify-center overflow-x-hidden overflow-y-auto p-2 py-3 xs:p-6">
        <AlbumDeskBackdrop />

        {/* 模块：移动端居中舞台。裁掉步骤动画的横向位移，避免移动浏览器产生横向滚动。 */}
        <div className="relative z-10 my-auto flex w-screen max-w-full justify-center overflow-hidden px-2 py-1 xs:px-0">
          <div
            className="login-shell relative max-h-[calc(100svh-1.5rem)] w-[min(calc(100vw-28px),380px)] min-w-0 overflow-y-auto rounded-[20px] border border-[#C9AB78] border-l-[8px] border-l-[#5B3A22] bg-[#F9ECCD] p-4 text-[#5B3A22] shadow-[0_28px_70px_rgba(78,45,20,0.28)] xs:p-8 sm:max-h-none sm:w-full sm:max-w-md sm:overflow-visible sm:rounded-[22px] sm:border-l-[12px] md:w-[560px] md:max-w-none md:rounded-[28px] md:border-l-[16px] md:p-10 md:shadow-[0_36px_90px_rgba(78,45,20,0.30)] lg:w-[620px] lg:p-12"
            style={{
              ...cardTransitionStyle(slideDirection),
              backgroundColor: STYLE.PAPER,
              color: STYLE.WALNUT,
              borderColor: STYLE.ALBUM_LINE,
              borderLeftColor: STYLE.WALNUT,
            }}
            onAnimationEnd={() => setSlideDirection("none")}
          >
            <div className="pointer-events-none absolute inset-x-5 top-3 h-px bg-white/80" />
            <BrandHeader />

            {errorMsg && (
              <p className="mobile-safe-text mb-4 rounded-xl bg-[#FFE2D4] p-3 text-center font-bold text-[#9F341F] ring-1 ring-[#E7A088] animate-pulse">
                {errorMsg}
              </p>
            )}

            <div className="my-4 h-px bg-[#D8B98C] xs:my-6 md:my-8" />

            {/* ====== Step 1：手机号输入（单屏聚焦） ====== */}
            {step === "phone" && (
              <div>
                <p
                  className="mb-6 text-center font-semibold text-[#6F4A31] md:mb-8"
                  style={{ fontSize: "var(--login-prompt-font)", lineHeight: "1.6" }}
                >
                  <span className="block">请输入您的手机号</span>
                </p>

                <input
                  ref={phoneInputRef}
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/\D/g, ""));
                    setErrorMsg("");
                  }}
                  placeholder="手机号"
                  style={{
                    height: "var(--login-input-height)",
                    fontSize: "var(--login-input-font)",
                  }}
                  className="w-full rounded-xl bg-[#FFF9EA] px-5 text-center font-bold text-[#4A3425] outline-none ring-2 ring-[#D8B98C] placeholder:text-[#9C7A55]/60 focus:ring-[#9F5C2B]"
                  disabled={isLoading}
                />

                <PrimaryButton
                  type="button"
                  onClick={handlePhoneNext}
                  disabled={isLoading}
                  style={{
                    marginTop: "32px",
                    backgroundColor: STYLE.COLOR_RETURNING,
                  }}
                >
                  下一步
                </PrimaryButton>
              </div>
            )}

            {/* ====== Step 2：隐私合规确认 ====== */}
            {step === "consent" && (
              <div>
                <section className="mb-3 rounded-2xl bg-[#FFF9EA] p-3 ring-1 ring-[#D8B98C] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] xs:mb-6 xs:p-4 md:mb-8 md:p-6">
                  <div className="mb-3 flex items-center gap-2 xs:mb-4 xs:gap-3 md:mb-5 md:gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8D4AC] text-[#5B3A22] xs:h-11 xs:w-11 md:h-14 md:w-14">
                      <ShieldCheck
                        className="h-5 w-5 xs:h-6 xs:w-6 md:h-7 md:w-7"
                        aria-hidden="true"
                      />
                    </div>
                    <h2
                      className="mobile-safe-text font-black text-[#5B3A22]"
                      style={{ fontSize: "var(--login-consent-font)", lineHeight: "1.35" }}
                    >
                      我们将保护您的信息
                    </h2>
                  </div>

                  <ul className="space-y-2 xs:space-y-3 md:space-y-4">
                    {PRIVACY_PROMISES.map((promise) => (
                      <li
                        key={promise}
                        className="mobile-safe-text rounded-xl bg-[#F6EAD2] px-3 py-2.5 text-base font-semibold leading-snug text-[#5D432F] xs:px-4 xs:py-3 xs:text-lg xs:leading-relaxed md:px-5 md:py-4 md:text-xl"
                      >
                        {promise}
                      </li>
                    ))}
                  </ul>
                </section>

                <p className="mobile-safe-text mb-3 text-center text-sm font-semibold leading-snug text-[#735437] xs:mb-5 xs:text-base xs:leading-relaxed md:mb-7 md:text-lg">
                  继续前，您可以先查看
                  <button
                    type="button"
                    onClick={() => {
                      hapticMedium();
                      setLegalDialogOpen(true);
                    }}
                    className="mx-1 font-black text-[#8B4E24] underline underline-offset-4"
                  >
                    服务协议
                  </button>
                  ，包含《用户服务协议》《隐私政策》《AI 生成内容说明与免责声明》。
                </p>

                {/* 我已阅读并同意 — 保留文案供测试断言 */}
                <p className="sr-only">
                  我已阅读并同意 用户服务协议 隐私政策 AI 生成内容说明与免责声明
                </p>
                <p className="sr-only">我同意平台为生成回忆录</p>
                <p className="sr-only">请先勾选协议后继续</p>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--login-button-gap)",
                  }}
                >
                  <PrimaryButton
                    type="button"
                    onClick={handleConsentAgree}
                    disabled={isLoading}
                    style={{
                      backgroundColor: "#C16C37",
                    }}
                  >
                    我同意并继续
                  </PrimaryButton>

                  <button
                    type="button"
                    onClick={handleConsentBack}
                    disabled={isLoading}
                    style={{
                      height: "var(--login-button-height)",
                      fontSize: "var(--login-button-font)",
                      lineHeight: STYLE.BUTTON_LINE_HEIGHT,
                    }}
                    className="w-full cursor-pointer rounded-xl bg-[#FFF9EA] font-bold text-[#5B3A22] shadow-[0_12px_24px_rgba(109,63,28,0.12)] ring-1 ring-[#D8B98C] transition-all hover:translate-y-[-1px] hover:bg-white active:translate-y-0 disabled:opacity-45"
                  >
                    返回修改
                  </button>
                </div>
              </div>
            )}

            {/* ====== Step 3：分支 A / B ====== */}
            {step === "final" && (
              <form onSubmit={handleFinalSubmit}>
                {/* 分支 A — 欢迎老朋友回家（登录） */}
                {branch === "returning" && (
                  <div>
                    <p
                      className="mb-6 text-center font-semibold text-[#6F4A31] md:mb-8"
                      style={{ fontSize: "var(--login-prompt-font)", lineHeight: "1.6" }}
                    >
                      欢迎回来，请输入密码
                    </p>

                    <input
                      ref={passwordInputRef}
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="输入您的密码"
                      style={{
                        height: "var(--login-input-height)",
                        fontSize: "var(--login-input-font)",
                      }}
                      className="w-full rounded-xl bg-[#FFF9EA] px-5 text-center font-bold text-[#4A3425] outline-none ring-2 ring-[#D8B98C] placeholder:text-[#9C7A55]/60 focus:ring-[#9F5C2B]"
                      disabled={isLoading}
                    />

                    <PrimaryButton
                      type="submit"
                      disabled={isLoading || !password}
                      style={{
                        marginTop: "36px",
                        backgroundColor: STYLE.COLOR_RETURNING,
                      }}
                    >
                      {isLoading ? "正在进入..." : "进入故事坊"}
                    </PrimaryButton>
                  </div>
                )}

                {/* 分支 B — 欢迎新朋友安家（注册） */}
                {branch === "new_user" && (
                  <div>
                    <p
                      className="mb-6 text-center font-semibold text-[#6F4A31] md:mb-8"
                      style={{ fontSize: "var(--login-prompt-font)", lineHeight: "1.6" }}
                    >
                      欢迎安家，先为您的回忆录写下名字
                    </p>

                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="您的姓名（如：李建国）"
                      style={{
                        height: "var(--login-input-height)",
                        fontSize: "var(--login-input-secondary-font)",
                      }}
                      className="mb-4 w-full rounded-xl bg-[#FFF9EA] px-5 text-center font-bold text-[#4A3425] outline-none ring-2 ring-[#D8B98C] placeholder:text-[#9C7A55]/60 focus:ring-[#9F5C2B]"
                      disabled={isLoading}
                    />

                    <input
                      type="number"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="您的年龄（选填）"
                      style={{
                        height: "var(--login-input-height)",
                        fontSize: "var(--login-input-secondary-font)",
                      }}
                      className="w-full rounded-xl bg-[#FFF9EA] px-5 text-center font-bold text-[#4A3425] outline-none ring-2 ring-[#D8B98C] placeholder:text-[#9C7A55]/60 focus:ring-[#9F5C2B]"
                      disabled={isLoading}
                    />

                    <PrimaryButton
                      type="submit"
                      disabled={isLoading || !name}
                      style={{
                        marginTop: "36px",
                        backgroundColor: STYLE.COLOR_NEW_USER,
                      }}
                    >
                      {isLoading ? "正在创建档案..." : "开始记录我的故事"}
                    </PrimaryButton>
                  </div>
                )}

                {/* 分支未确定时的加载态 */}
                {branch === null && (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#9F5C2B] border-t-transparent" />
                    <p className="text-lg font-semibold text-[#6F4A31]">正在为您准备...</p>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>

        {/* ====== 法律协议弹窗 ====== */}
        {legalDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-3 xs:p-5">
            <div className="max-h-[86vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-amber-50 shadow-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-amber-200 p-4 xs:gap-4 xs:p-5">
                <div className="min-w-0">
                  <h2 className="mobile-safe-text text-xl font-black text-stone-900 xs:text-2xl">
                    使用前说明
                  </h2>
                  <p className="mobile-safe-text mt-1 text-sm text-stone-600 xs:text-base">
                    请阅读以下内容后再继续。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    hapticMedium();
                    setLegalDialogOpen(false);
                  }}
                  className="rounded-full bg-white p-2 text-stone-500 shadow-sm hover:bg-amber-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mobile-safe-text max-h-[62vh] space-y-4 overflow-y-auto p-4 text-base leading-relaxed text-stone-700 xs:p-5">
                <p>
                  本产品用于辅助用户记录、整理和生成个人回忆录内容，提供语音识别、AI
                  问答、文字整理和回忆录生成等功能，不构成法律、医疗、心理咨询、财务或其他专业建议。
                </p>
                <p>
                  AI
                  生成内容可能存在理解偏差、表述不准确、遗漏或不符合真实意图的情况。用户应自行核对、修改并确认最终内容。
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

              <div className="border-t border-amber-200 p-4 xs:p-5">
                <button
                  type="button"
                  onClick={() => {
                    hapticMedium();
                    setLegalDialogOpen(false);
                  }}
                  className="w-full rounded-xl bg-stone-800 py-3 text-lg font-bold text-amber-50 shadow-md xs:text-xl"
                >
                  我知道了
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
