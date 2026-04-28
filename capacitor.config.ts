import type { CapacitorConfig } from "@capacitor/cli";

const isBundledBuild = process.env.CAPACITOR_BUNDLED === "1";

const config: CapacitorConfig = {
  appId: "online.traitorsfantasydraft.app",
  appName: "Traitors Fantasy Draft",
  webDir: isBundledBuild ? "native-web" : "public",
  ...(isBundledBuild
    ? {}
    : {
        server: {
          url: "https://traitorsfantasydraft.online",
          cleartext: false,
        },
      }),
};

export default config;
