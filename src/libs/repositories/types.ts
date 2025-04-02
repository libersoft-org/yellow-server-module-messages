export interface MessageReaction {
 id: number;
 id_users: number;
 message_uid: string;
 emoji_codepoints_rgi: string;
 emoji_shortcode: string;
 created: Date;
 updated: Date;
}

export interface ReactionByCodepointsRDI {
 emoji_codepoints_rgi?: string;
}

export type ReactionByShortcodeOrUnicode = ReactionByCodepointsRDI;
