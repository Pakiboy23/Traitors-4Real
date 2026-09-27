import type { ReactNode } from "react";
import { PremiumCard } from "../../ui/premium";

const ResetPasswordFrame = ({ children }: { children: ReactNode }) => {
  return (
    <main className="app-shell">
      <div className="max-w-lg mx-auto mt-8 md:mt-12 premium-page premium-admin-auth">
        <PremiumCard className="premium-panel-pad premium-stack-md">{children}</PremiumCard>
      </div>
    </main>
  );
};

export default ResetPasswordFrame;
