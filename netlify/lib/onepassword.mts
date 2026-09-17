import {
    ARCHIVE_ITEMS,
    AutofillBehavior,
    CREATE_ITEMS,
    type Client,
    DELETE_ITEMS,
    ItemCategory,
    ItemFieldType,
    READ_ITEMS,
    REVEAL_ITEM_PASSWORD,
    UPDATE_ITEMS,
    createClient,
} from "@1password/sdk";

/**
 * The portal's 1Password vault writer — one vault per client, filled from the
 * Account Setup section of the Onboarding Form.
 *
 * WHY THE SERVICE ACCOUNT CREATES THE VAULT, and why an account manager must not
 * create it by hand:
 *
 *   A 1Password service account can only manage permissions for vaults IT created
 *   (https://www.1password.dev/sdks/vault-permissions/), and its own vault access is
 *   fixed when the service account is made and cannot be widened afterwards. So a vault
 *   an AM creates in the 1Password app is permanently unreachable from here — we could
 *   never be granted access to it, let alone share it with the team. The only order that
 *   works is the one below: WE create the vault, so WE can grant the team group access to
 *   it, and only then do we write items into it.
 *
 *   The practical consequence for the team: never pre-create a client's vault by hand.
 *   An empty hand-made vault with the right name is worse than no vault at all, because
 *   this code cannot see it and will make a second one beside it.
 *
 * Environment (Netlify UI → Site settings → Environment variables, never netlify.toml —
 * these are secrets, and netlify.toml is committed):
 *
 *   OP_SERVICE_ACCOUNT_TOKEN — a 1Password service account token. The service account
 *     MUST be created with permission to create vaults; that cannot be added later, so a
 *     service account made without it has to be replaced rather than edited.
 *   OP_TEAM_GROUP_ID — the 1Password group ID every client vault is shared with (the
 *     whole HiddenGem team). A group, not a list of people: someone who joins the group
 *     inherits every client vault at once, and someone removed from it loses all of them
 *     at once, which is the only version of this that stays correct as the team changes.
 *     The SDK's Groups API can only `get` a group by ID — it cannot search by name — so
 *     this is configuration, copied from the group's URL in the 1Password admin console.
 *
 * With either variable missing, `readOnePasswordEnv` returns null and the caller answers
 * one clear "not configured" message. It never half-works.
 */

/** Vault titles are the lookup key, so the shape has to be stable. Two clients with the
    same business name would collide, which is why the slug — unique by construction, it
    is the row's primary key — is what actually disambiguates. */
export const vaultTitleFor = (clientName: string, slug: string) => {
    const name = clientName.trim();
    return name ? `${name} (${slug})` : slug;
};

/**
 * What the team group gets on every client vault: read, reveal, and full item
 * management — everything except MANAGE_VAULT.
 *
 * MANAGE_VAULT is deliberately withheld. It would let any team member re-share the vault
 * onward or change its permissions, which is the one action that could quietly widen who
 * can see a client's logins. Nothing the team does day to day needs it; an owner or
 * administrator in the 1Password console can still do it deliberately.
 */
export const TEAM_VAULT_PERMISSIONS = READ_ITEMS | REVEAL_ITEM_PASSWORD | CREATE_ITEMS | UPDATE_ITEMS | ARCHIVE_ITEMS | DELETE_ITEMS;

export interface OnePasswordEnv {
    token: string;
    groupId: string;
}

export const readOnePasswordEnv = (): OnePasswordEnv | null => {
    const token = process.env.OP_SERVICE_ACCOUNT_TOKEN?.trim();
    const groupId = process.env.OP_TEAM_GROUP_ID?.trim();
    return token && groupId ? { token, groupId } : null;
};

export const NOT_CONFIGURED = "1Password isn't connected — ask the web team to check OP_SERVICE_ACCOUNT_TOKEN and OP_TEAM_GROUP_ID in Netlify.";

export const opClient = (env: OnePasswordEnv): Promise<Client> =>
    createClient({
        auth: env.token,
        integrationName: "HGM Portal",
        integrationVersion: "1.0.0",
    });

/**
 * The client's vault, made on first submit and reused on every later one.
 *
 * Idempotent on purpose: a client who edits an answer and submits again must land in the
 * same vault, not a second one. The lookup is by exact title against the vaults this
 * service account can see, which — since it can only see what it created — is exactly the
 * set of client vaults.
 *
 * The group grant happens only on creation. Re-granting an existing grant is not
 * something this needs to retry, and doing it on every submit would turn a permissions
 * change someone made deliberately in the console into something we silently stamp back.
 */
export const findOrCreateClientVault = async (client: Client, env: OnePasswordEnv, title: string): Promise<{ id: string; created: boolean }> => {
    const existing = await client.vaults.list();
    const match = existing.find((v) => v.title === title);
    if (match) return { id: match.id, created: false };

    const vault = await client.vaults.create({
        title,
        description: "Client logins captured from the HGM onboarding form. Created automatically — do not rename.",
    });
    await client.vaults.grantGroupPermissions(vault.id, [{ groupId: env.groupId, permissions: TEAM_VAULT_PERMISSIONS }]);
    return { id: vault.id, created: true };
};

export interface LoginToWrite {
    /** Item title inside the vault, e.g. "Instagram" or "Guesty (PMS)". */
    title: string;
    username: string;
    password: string;
    /** Autofill URL, when we know one for the platform. */
    website?: string;
    /** Public @handle, kept beside the login because it is not the login. */
    handle?: string;
}

/**
 * Write one login, replacing the item of the same title if there is one.
 *
 * Replace rather than append: a client who corrects a password and resubmits should end
 * up with one item holding the right password, not two items where the team has to guess
 * which is current. 1Password keeps the previous value in the item's own history, so
 * nothing is actually lost by overwriting.
 */
export const writeLogin = async (client: Client, vaultId: string, login: LoginToWrite): Promise<"created" | "updated"> => {
    const fields = [
        { id: "username", title: "username", fieldType: ItemFieldType.Text, value: login.username },
        { id: "password", title: "password", fieldType: ItemFieldType.Concealed, value: login.password },
    ];
    if (login.handle) fields.push({ id: "handle", title: "handle", fieldType: ItemFieldType.Text, value: login.handle });

    const websites = login.website ? [{ url: login.website, label: "website", autofillBehavior: AutofillBehavior.AnywhereOnWebsite }] : [];

    const existing = (await client.items.list(vaultId)).find((i) => i.title === login.title);
    if (existing) {
        const item = await client.items.get(vaultId, existing.id);
        await client.items.put({ ...item, fields, websites });
        return "updated";
    }

    await client.items.create({
        category: ItemCategory.Login,
        vaultId,
        title: login.title,
        fields,
        websites,
    });
    return "created";
};
