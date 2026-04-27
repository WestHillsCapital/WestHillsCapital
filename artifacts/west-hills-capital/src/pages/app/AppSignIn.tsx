import { SignIn } from "@clerk/react";
import { shadcn } from "@clerk/themes";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const APP_NAME = "Docuplete";

const appearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: `${basePath}/app`,
  },
  variables: {
    colorPrimary: "#111827",
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
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-sm border border-gray-200",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-gray-900 font-semibold",
    headerSubtitle: "text-gray-500",
    socialButtonsBlockButtonText: "text-gray-700",
    formFieldLabel: "text-gray-700 font-medium",
    footerActionLink: "text-gray-900 font-medium hover:text-gray-700",
    footerActionText: "text-gray-500",
    dividerText: "text-gray-400",
    identityPreviewEditButton: "text-gray-600",
    formFieldSuccessText: "text-green-600",
    alertText: "text-red-600",
    logoBox: "justify-center",
    logoImage: "h-8 w-8",
    socialButtonsBlockButton: "border-gray-200 hover:bg-gray-50",
    formButtonPrimary: "bg-gray-900 hover:bg-gray-800",
    formFieldInput: "border-gray-300 bg-gray-50 focus:border-gray-900",
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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <p className="text-2xl font-semibold text-gray-900">{APP_NAME}</p>
        <p className="text-sm text-gray-500 mt-1">Guided paperwork, handled.</p>
      </div>
      <SignIn
        routing="path"
        path={`${basePath}/app/sign-in`}
        signUpUrl={`${basePath}/app/sign-up`}
        forceRedirectUrl={`${basePath}/app`}
        appearance={appearance}
      />
    </div>
  );
}
