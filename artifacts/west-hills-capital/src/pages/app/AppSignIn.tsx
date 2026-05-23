import { SignIn } from "@clerk/react";
import { shadcn } from "@clerk/themes";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const APP_NAME = "Docuplete";

const appearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: `${basePath}/`,
  },
  variables: {
    colorPrimary: "#1B4FD8",
    colorForeground: "#111827",
    colorMutedForeground: "#6b7280",
    colorDanger: "#dc2626",
    colorBackground: "#ffffff",
    colorInput: "#f9fafb",
    colorInputForeground: "#111827",
    colorNeutral: "#d1d5db",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-sm border border-[#E8EDF5]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#0B1220] font-semibold",
    headerSubtitle: "text-gray-500",
    socialButtonsBlockButtonText: "text-gray-700",
    formFieldLabel: "text-gray-700 font-medium",
    footerActionLink: "!text-[#1B4FD8] font-semibold hover:!text-[#1740B8]",
    footerActionText: "text-gray-500",
    dividerText: "text-gray-400",
    identityPreviewEditButton: "text-gray-600",
    formFieldSuccessText: "text-green-600",
    alertText: "text-red-600",
    logoBox: "justify-center",
    logoImage: "h-8 w-8",
    socialButtonsBlockButton: "border-gray-200 hover:bg-gray-50",
    formButtonPrimary: "!bg-[#1B4FD8] hover:!bg-[#1740B8] !text-white !font-semibold !shadow-none",
    formFieldInput: "border-[#E8EDF5] bg-gray-50 focus:border-[#1B4FD8] focus:ring-[#1B4FD8]",
    footerAction: "text-center",
    dividerLine: "bg-gray-200",
    alert: "border-red-200 bg-red-50",
    otpCodeFieldInput: "border-gray-300",
    formFieldRow: "gap-3",
    main: "p-6",
  },
};

export default function AppSignIn() {
  return (
    <div className="min-h-screen bg-[#F8FAFF] flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2.5">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 4h18l6 6v22H6V4z" fill="#0E1D4A" />
        <path d="M24 4l6 6h-6V4z" fill="#C49A38" />
        <rect x="10" y="14" width="10" height="1.5" rx="0.75" fill="white" opacity="0.5" />
        <rect x="10" y="18" width="14" height="1.5" rx="0.75" fill="white" opacity="0.5" />
        <rect x="10" y="22" width="8" height="1.5" rx="0.75" fill="white" opacity="0.5" />
        <circle cx="26" cy="28" r="5" fill="#C49A38" />
        <path d="M23.5 28l2 2 3.5-3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
          <span className="text-[#0B1220] font-bold text-2xl tracking-tight">{APP_NAME}</span>
        </div>
        <p className="text-sm text-[#4B5A7A]">Cut Cost. Save Time. Get It Right.</p>
      </div>
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={`${basePath}/`}
        appearance={appearance}
      />
    </div>
  );
}
