export type ResolvedQrTarget = {
  targetType: "poi" | "tour";
  targetId: number;
  requiresPayment: boolean;
};

export type PublicDetailDestination = {
  screen: "poi-detail" | "tour-detail";
  id: number;
  languageCode: string;
};

export type AudioEntryAction = "start-guest-access" | "show-payment";

/**
 * Creates the guest QR visit state after the API has resolved the QR target
 * and the guest language has been selected. Public detail is always available;
 * payment only gates the audio entry action.
 */
export function createQrVisit(
  target: ResolvedQrTarget,
  languageCode: string,
): { destination: PublicDetailDestination; audioEntryAction: AudioEntryAction } {
  const normalizedLanguage = languageCode.trim();
  if (!normalizedLanguage) throw new Error("A selected language is required for a QR visit");

  return {
    destination: {
      screen: target.targetType === "poi" ? "poi-detail" : "tour-detail",
      id: target.targetId,
      languageCode: normalizedLanguage,
    },
    audioEntryAction: target.requiresPayment ? "show-payment" : "start-guest-access",
  };
}