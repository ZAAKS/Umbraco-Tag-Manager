var g = (t) => {
  throw TypeError(t);
};
var A = (t, e, a) => e.has(t) || g("Cannot " + a);
var m = (t, e, a) => e.has(t) ? g("Cannot add the same private member more than once") : e instanceof WeakSet ? e.add(t) : e.set(t, a);
var _ = (t, e, a) => (A(t, e, "access private method"), a);
import { html as f, css as $, state as p, customElement as E } from "@umbraco-cms/backoffice/external/lit";
import { UmbModalBaseElement as M } from "@umbraco-cms/backoffice/modal";
import { UmbControllerBase as N } from "@umbraco-cms/backoffice/class-api";
import { UMB_AUTH_CONTEXT as O } from "@umbraco-cms/backoffice/auth";
const S = "/umbraco/TagManager/api/v1/TagAi";
var l, y;
class k extends N {
  constructor(a) {
    super(a);
    m(this, l);
  }
  async suggest(a) {
    const i = await _(this, l, y).call(this), r = await fetch(`${S}/suggest`, {
      method: "POST",
      headers: i,
      credentials: "include",
      body: JSON.stringify(a)
    }), s = await r.json().catch(() => null);
    if (!r.ok)
      throw new Error((s == null ? void 0 : s.message) || "Tag suggestion failed.");
    return Array.isArray(s == null ? void 0 : s.tags) ? s.tags.filter((o) => typeof o == "string" && o.trim().length > 0) : [];
  }
}
l = new WeakSet(), y = async function() {
  const a = await this.getContext(O), i = await (a == null ? void 0 : a.getLatestToken());
  return {
    "Content-Type": "application/json",
    ...i ? { Authorization: `Bearer ${i}` } : {}
  };
};
var P = Object.defineProperty, U = Object.getOwnPropertyDescriptor, b = (t) => {
  throw TypeError(t);
}, c = (t, e, a, i) => {
  for (var r = i > 1 ? void 0 : i ? U(e, a) : e, s = t.length - 1, o; s >= 0; s--)
    (o = t[s]) && (r = (i ? o(e, a, r) : o(r)) || r);
  return i && r && P(e, a, r), r;
}, C = (t, e, a) => e.has(t) || b("Cannot " + a), B = (t, e, a) => (C(t, e, "read from private field"), a ? a.call(t) : e.get(t)), v = (t, e, a) => e.has(t) ? b("Cannot add the same private member more than once") : e instanceof WeakSet ? e.add(t) : e.set(t, a), h = (t, e, a) => (C(t, e, "access private method"), a), d, u, w, T, x;
let n = class extends M {
  constructor() {
    super(...arguments), v(this, u), v(this, d, new k(this)), this._count = 5, this._saving = !1, this._error = "";
  }
  render() {
    return f`
			<umb-modal-layout headline="Create tags with AI">
				<form @submit=${h(this, u, T)}>
					<uui-box>
						<umb-property-layout
							label="How many tags?"
							description="Umbraco.AI reads this item and adds the tags to the field. Save the content to keep them.">
							<uui-input
								slot="editor"
								type="number"
								min="1"
								max="20"
								.value=${String(this._count)}
								@input=${h(this, u, w)}
								label="Number of tags"
								required>
							</uui-input>
						</umb-property-layout>
						${this._error ? f`<p class="error">${this._error}</p>` : ""}
					</uui-box>
					<div slot="actions">
						<uui-button label="Cancel" look="secondary" @click=${h(this, u, x)} ?disabled=${this._saving}>
							Cancel
						</uui-button>
						<uui-button
							type="submit"
							look="primary"
							color="positive"
							label="Create"
							?disabled=${this._saving || this._count < 1 || this._count > 20}
							.state=${this._saving ? "waiting" : void 0}>
							${this._saving ? "Creating..." : "Create"}
						</uui-button>
					</div>
				</form>
			</umb-modal-layout>
		`;
  }
};
d = /* @__PURE__ */ new WeakMap();
u = /* @__PURE__ */ new WeakSet();
w = function(t) {
  const e = Number(t.target.value);
  this._count = Number.isFinite(e) ? e : 0;
};
T = async function(t) {
  var e, a, i, r, s;
  if (t.preventDefault(), this._count < 1 || this._count > 20) {
    this._error = "Choose between 1 and 20 tags.";
    return;
  }
  this._saving = !0, this._error = "";
  try {
    const o = await B(this, d).suggest({
      count: this._count,
      contentName: ((e = this.data) == null ? void 0 : e.contentName) ?? "",
      contentText: ((a = this.data) == null ? void 0 : a.contentText) ?? "",
      existingTags: ((i = this.data) == null ? void 0 : i.existingTags) ?? []
    });
    if (o.length === 0) {
      this._error = "Umbraco.AI did not return any new tags.";
      return;
    }
    (r = this.modalContext) == null || r.setValue({ tags: o }), (s = this.modalContext) == null || s.submit();
  } catch (o) {
    this._error = o instanceof Error ? o.message : "Tag suggestion failed.";
  } finally {
    this._saving = !1;
  }
};
x = function() {
  var t;
  (t = this.modalContext) == null || t.reject();
};
n.styles = $`
		form {
			display: flex;
			flex-direction: column;
		}

		.error {
			margin: var(--uui-size-space-4) 0 0;
			color: var(--uui-color-danger);
		}

		[slot='actions'] {
			display: flex;
			justify-content: flex-end;
			gap: var(--uui-size-space-3);
		}
	`;
c([
  p()
], n.prototype, "_count", 2);
c([
  p()
], n.prototype, "_saving", 2);
c([
  p()
], n.prototype, "_error", 2);
n = c([
  E("tag-ai-create-modal")
], n);
const H = n;
export {
  n as AiCreateTagsModalElement,
  H as default
};
//# sourceMappingURL=ai-create-tags-modal.element-UDLCyV4h.js.map
