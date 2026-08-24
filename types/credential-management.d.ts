/** Password Credential Management API (Chrome / Android Google Password Manager). */
interface PasswordCredentialData {
  id: string;
  password: string;
  name?: string;
  iconURL?: string;
}

interface PasswordCredential extends Credential {
  readonly type: "password";
  readonly password: string;
  readonly name?: string;
  readonly iconURL?: string;
}

declare const PasswordCredential: {
  new (data: PasswordCredentialData): PasswordCredential;
};

interface CredentialRequestOptions {
  password?: boolean;
  mediation?: CredentialMediationRequirement;
}
