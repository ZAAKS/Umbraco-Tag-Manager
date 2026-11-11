import { UmbPropertyActionBase as T } from "@umbraco-cms/backoffice/property-action";
import { UMB_PROPERTY_CONTEXT as d, UMB_PROPERTY_DATASET_CONTEXT as A } from "@umbraco-cms/backoffice/property";
import { UmbModalToken as h, UMB_MODAL_MANAGER_CONTEXT as C } from "@umbraco-cms/backoffice/modal";
import { UMB_NOTIFICATION_CONTEXT as y } from "@umbraco-cms/backoffice/notification";
const _ = new h(
  "TagManager.Modal.AiCreateTags",
  {
    modal: {
      type: "dialog",
      size: "small"
    }
  }
);
function m(e) {
  if (typeof e == "string")
    return e.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (Array.isArray(e))
    return e.filter((t) => typeof t == "string").join(", ");
  if (e && typeof e == "object" && "markup" in e) {
    const t = e.markup;
    return typeof t == "string" ? m(t) : "";
  }
  return "";
}
function u(e) {
  return Array.isArray(e) ? e.filter((t) => typeof t == "string" && t.trim().length > 0) : typeof e == "string" ? e.split(",").map((t) => t.trim()).filter((t) => t.length > 0) : [];
}
class L extends T {
  async execute() {
    var c;
    const t = await this.getContext(d);
    if (!t) return;
    const o = await this.getContext(A), f = t.getAlias(), n = u(t.getValue()), l = (await (o == null ? void 0 : o.getProperties()) ?? []).filter((r) => r.alias !== f).map((r) => m(r.value)).filter((r) => r.length > 0).join(`
`).slice(0, 6e3), s = await this.getContext(C);
    if (!s) return;
    const a = await s.open(this, _, {
      data: {
        contentName: (o == null ? void 0 : o.getName()) ?? "",
        contentText: l,
        existingTags: n
      }
    }).onSubmit().catch(() => {
    });
    if (!((c = a == null ? void 0 : a.tags) != null && c.length)) return;
    const g = new Set(n.map((r) => r.toLocaleLowerCase())), p = [...n];
    for (const r of a.tags)
      g.has(r.toLocaleLowerCase()) || (g.add(r.toLocaleLowerCase()), p.push(r));
    t.setValue(p);
    const i = await this.getContext(y);
    i == null || i.peek("positive", {
      data: {
        headline: "Tags added",
        message: `${a.tags.length} tag${a.tags.length === 1 ? "" : "s"} added. Save to keep them.`
      }
    });
  }
}
export {
  L as CreateTagsWithAiAction,
  L as api
};
//# sourceMappingURL=create-tags-with-ai.action-BuchR7L4.js.map
