var h = (r) => {
  throw TypeError(r);
};
var d = (r, a, t) => a.has(r) || h("Cannot " + t);
var p = (r, a, t) => (d(r, a, "read from private field"), t ? t.call(r) : a.get(r)), f = (r, a, t) => a.has(r) ? h("Cannot add the same private member more than once") : a instanceof WeakSet ? a.add(r) : a.set(r, t), y = (r, a, t, e) => (d(r, a, "write to private field"), e ? e.call(r, t) : a.set(r, t), t), l = (r, a, t) => (d(r, a, "access private method"), t);
import { UmbTreeServerDataSourceBase as G, UmbTreeRepositoryBase as I } from "@umbraco-cms/backoffice/tree";
import { T as C } from "./tagmanager-repository-BvW2JE0F.js";
import { U as O } from "./index-CoNCoqT9.js";
var s, o, T, R;
class q extends G {
  constructor(t) {
    super(t, {
      getRootItems: (e) => this.getRootItems(e),
      getChildrenOf: (e) => this.getChildrenOf(e),
      getAncestorsOf: (e) => this.getAncestorsOf(e),
      mapper: (e) => e
    });
    f(this, o);
    f(this, s);
    y(this, s, new C(t));
  }
  async getRootItems(t) {
    const e = await p(this, s).getTagGroups();
    return { data: { items: l(this, o, T).call(this, e), total: e.length } };
  }
  async getChildrenOf(t) {
    const e = t.parent.entityType, n = t.parent.unique;
    if (e === "tagmanager-root" || e == null && (n == null || n === "")) {
      const u = await p(this, s).getTagGroups();
      return { data: { items: l(this, o, T).call(this, u), total: u.length } };
    }
    return e === "tagmanager-group" ? { data: { items: [], total: 0 } } : { data: { items: [], total: 0 } };
  }
  async getAncestorsOf(t) {
    if (t.treeItem.entityType !== "tagmanager-tag")
      return { data: { items: [], total: 0 } };
    const e = await p(this, s).getTagGroups(), n = t.treeItem.parent;
    if ((n == null ? void 0 : n.entityType) === "tagmanager-group" && n.unique) {
      const c = e.find((g) => (g.group || g.Group || "") === n.unique);
      if (c) {
        const g = c.group || c.Group || "default";
        return { data: { items: [
          {
            unique: g,
            parent: null,
            name: g,
            entityType: "tagmanager-group",
            type: "tagmanager-group",
            hasChildren: !1,
            icon: "icon-tags",
            isFolder: !1
          }
        ], total: 1 } };
      }
    }
    const i = l(this, o, R).call(this, t.treeItem.unique);
    if (i == null)
      return { data: { items: [], total: 0 } };
    const u = await p(this, s).getTagById(i);
    if (!u)
      return { data: { items: [], total: 0 } };
    const m = u.group || u.Group || "default";
    return { data: { items: [
      {
        unique: m,
        parent: null,
        name: m,
        entityType: "tagmanager-group",
        type: "tagmanager-group",
        hasChildren: !1,
        icon: "icon-tags",
        isFolder: !1
      }
    ], total: 1 } };
  }
}
s = new WeakMap(), o = new WeakSet(), T = function(t) {
  return t.map((e) => {
    const n = e.group || e.Group || "default";
    return {
      unique: n,
      parent: null,
      name: n,
      entityType: "tagmanager-group",
      type: "tagmanager-group",
      hasChildren: !1,
      icon: "icon-tags",
      isFolder: !1
    };
  });
}, R = function(t) {
  if (t == null || t === "") return null;
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  const e = t.split("-");
  for (let n = e.length - 1; n >= 0; n--) {
    const i = parseInt(e[n], 10);
    if (!Number.isNaN(i)) return i;
  }
  return null;
};
class U extends I {
  constructor(a) {
    super(a, q, O);
  }
  async requestTreeRoot() {
    const { data: a } = await this._treeSource.getRootItems({ skip: 0, take: 1 });
    return { data: {
      unique: null,
      entityType: "tagmanager-root",
      name: "Tag Manager",
      hasChildren: a ? a.total > 0 : !1,
      isFolder: !0
    } };
  }
}
export {
  U as TagManagerTreeRepository,
  U as default
};
//# sourceMappingURL=tagmanager-tree.repository-B359XC0w.js.map
