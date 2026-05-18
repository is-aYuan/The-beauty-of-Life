import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mic } from "lucide-react";
import {
  clearMicrophoneReady,
  requestMicrophonePermission,
} from "../lib/microphonePermission.js";

export const Route = createFileRoute("/mic-setup")({
  component: MicSetupPage,
});

function MicSetupPage() {
  const navigate = useNavigate();
  const [isRequesting, setIsRequesting] = useState(false);
  const [message, setMessage] = useState("");
  const hasLocalUser = typeof localStorage !== "undefined" && !!localStorage.getItem("story_user");

  useEffect(() => {
    if (!hasLocalUser) {
      navigate({ to: "/login" });
    }
  }, [hasLocalUser, navigate]);

  if (!hasLocalUser) return null;

  const enterHome = () => {
    navigate({ to: "/" });
  };

  const handleEnableMicrophone = async () => {
    setIsRequesting(true);
    setMessage("");
    try {
      await requestMicrophonePermission();
    } catch {
      clearMicrophoneReady();
      setMessage("麦克风暂时没有开启，进入首页后也可以再开启。");
    } finally {
      setIsRequesting(false);
      enterHome();
    }
  };

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-amber-50 p-6 text-stone-900">
      <section className="flex min-h-[78vh] w-full max-w-3xl flex-col items-center justify-center rounded-3xl border border-amber-200 bg-white px-8 py-12 shadow-xl">
        <div className="flex min-h-[240px] w-full max-w-xl items-center justify-center rounded-2xl border border-stone-300 bg-amber-50/40 p-8 text-center">
          <h1 className="text-3xl font-bold leading-relaxed text-stone-800">
            开启麦克风，开始讲述您的故事吧
          </h1>
        </div>

        <button
          onClick={handleEnableMicrophone}
          disabled={isRequesting}
          className="mt-8 flex h-44 w-44 items-center justify-center rounded-full border-2 border-stone-500 bg-white text-2xl font-bold text-stone-800 shadow-sm transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
        >
          <span className="flex flex-col items-center gap-3">
            <Mic className="h-9 w-9" />
            {isRequesting ? "开启中..." : "开启麦克风"}
          </span>
        </button>

        <button
          onClick={enterHome}
          disabled={isRequesting}
          className="mt-8 rounded-md border border-stone-400 bg-white px-14 py-3 text-lg font-semibold text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          先进入首页
        </button>

        {message && (
          <p className="mt-5 text-center text-base font-medium text-stone-500">
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
