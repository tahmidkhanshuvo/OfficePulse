export interface PinVerifierOptions {
  pinHash: string;
  nodeEnv: string;
  devPin?: string;
}

export async function verifyPlatformPin(pin: string, options: PinVerifierOptions): Promise<boolean> {
  if (!/^\d{6}$/.test(pin)) return false;

  if (!options.pinHash) {
    return options.nodeEnv !== "production" && pin === (options.devPin ?? "123456");
  }

  try {
    return await Bun.password.verify(pin, options.pinHash);
  } catch {
    return false;
  }
}
