# Access Control & Share Links

The `files-plugin` supports capability-based permissions and secure link sharing.

---

## Capability Access Grants

Access can be granted or revoked per-user on individual directories or specific files:

### Granting Access (`file.access.granted@1.0.0`)

```javascript
await engine.ingress('file.access.granted@1.0.0', {
  targetId: 'dir_financials_2026',
  targetType: 'directory',
  granteeId: 'user_natasha',
  permissions: ['read', 'write', 'share'],
  grantedAt: Date.now(),
})
```

### Revoking Access (`file.access.revoked@1.0.0`)

```javascript
await engine.ingress('file.access.revoked@1.0.0', {
  targetId: 'dir_financials_2026',
  granteeId: 'user_temp_auditor',
  revokedAt: Date.now(),
})
```

---

## Public & Token Share Links (`file.share.*`)

Create password-protected or expiring external share tokens:

```javascript
await engine.ingress('file.share.created@1.0.0', {
  shareId: 'share_tk_892348',
  linkId: 'link_whitepaper',
  expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
  maxDownloads: 5,
})
```
