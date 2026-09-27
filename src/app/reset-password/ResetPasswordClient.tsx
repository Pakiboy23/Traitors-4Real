"use client";

import dynamic from "next/dynamic";
import { PremiumPanelHeader } from "../../ui/premium";
import ResetPasswordFrame from "./ResetPasswordFrame";

const ResetPassword = dynamic(() => import("./ResetPassword"), {
  ssr: false,
  loading: () => (
    <ResetPasswordFrame>
      <PremiumPanelHeader
        kicker="Restricted"
        title="Reset password"
        description="Checking your reset link."
      />
    </ResetPasswordFrame>
  ),
});

export default function ResetPasswordClient() {
  return <ResetPassword />;
}
