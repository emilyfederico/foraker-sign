import { createContext, useContext } from 'react';

import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';

/**
 * Carries the callbacks used to update a single field in the V1 signing page's
 * local state after it has been signed or cleared.
 *
 * This lets the signing fields reflect their new state instantly from the
 * mutation result instead of re-running the entire route loader (which
 * re-fetches the whole document, every recipient and every field) via
 * `revalidate()` on each interaction.
 *
 * The V2 (envelope) signing flow already manages fields in local state via
 * `EnvelopeSigningProvider`; this brings the same behaviour to V1 documents.
 */
export interface DocumentSigningFieldUpdateContextValue {
  /**
   * Apply the updated field returned by the sign mutation to local state.
   */
  onFieldSigned: (field: FieldWithSignature) => void;

  /**
   * Mark a field as no longer inserted in local state.
   */
  onFieldRemoved: (fieldId: number) => void;
}

const DocumentSigningFieldUpdateContext =
  createContext<DocumentSigningFieldUpdateContextValue | null>(null);

export const DocumentSigningFieldUpdateProvider = DocumentSigningFieldUpdateContext.Provider;

/**
 * Returns the field-update callbacks when rendered inside the V1 signing page,
 * or `null` otherwise (e.g. embed flows), in which case callers should fall
 * back to `revalidate()`.
 */
export function useOptionalDocumentSigningFieldUpdate() {
  return useContext(DocumentSigningFieldUpdateContext);
}
