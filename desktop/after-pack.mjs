import path from 'node:path';
import { flipFuses, FuseVersion, FuseV1Options } from '@electron/fuses';
export default async function afterPack(context) {
  const binary = path.join(context.appOutDir, context.packager.appInfo.productFilename + '.exe');
  await flipFuses(binary, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
  });
}
