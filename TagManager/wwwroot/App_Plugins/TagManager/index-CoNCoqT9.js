import { UmbContextToken as r } from "@umbraco-cms/backoffice/context-api";
import { UmbUniqueTreeStore as i } from "@umbraco-cms/backoffice/tree";
class o extends i {
  constructor(a) {
    super(a, g.toString());
  }
}
const g = new r(
  "UmbTagManagerTreeStore"
), e = "TagManager.Tree.Repository", t = "TagManager.Tree", s = [
  {
    type: "section",
    alias: "TagManager.Section",
    name: "Tag Manager Section",
    weight: 10,
    meta: {
      label: "Tag Manager",
      pathname: "tagmanager",
      icon: "icon-tags"
    },
    conditions: [
      {
        alias: "Umb.Condition.SectionUserPermission",
        match: "TagManager.Section"
      }
    ]
  },
  {
    type: "dashboard",
    alias: "TagManager.Section.Dashboard",
    name: "Tag Manager Dashboard",
    elementName: "tagmanager-dashboard",
    js: () => import("./tagmanager-dashboard.element-B8lxsSW7.js"),
    weight: -10,
    meta: {
      label: "Dashboard"
    },
    conditions: [
      {
        alias: "Umb.Condition.SectionAlias",
        match: "TagManager.Section"
      }
    ]
  },
  {
    type: "sectionSidebarApp",
    kind: "menuWithEntityActions",
    alias: "TagManager.SectionSidebarMenu",
    name: "Tag Manager Section Sidebar Menu",
    weight: 100,
    meta: {
      label: "Tag Manager",
      menu: "TagManager.Menu"
    },
    conditions: [
      {
        alias: "Umb.Condition.SectionAlias",
        match: "TagManager.Section"
      }
    ]
  },
  {
    type: "menu",
    alias: "TagManager.Menu",
    name: "Tag Manager Menu"
  },
  {
    type: "menuItem",
    kind: "tree",
    alias: "TagManager.MenuItem.Tree",
    name: "Tag Manager Tree Menu Item",
    weight: 200,
    meta: {
      label: "Tag Groups",
      menus: ["TagManager.Menu"],
      treeAlias: t,
      hideTreeRoot: !0
    }
  },
  {
    type: "repository",
    alias: e,
    name: "Tag Manager Tree Repository",
    api: () => import("./tagmanager-tree.repository-B359XC0w.js")
  },
  {
    type: "treeStore",
    alias: "TagManager.Tree.Store",
    name: "Tag Manager Tree Store",
    api: o
  },
  {
    type: "tree",
    kind: "default",
    alias: t,
    name: "Tag Manager Tree",
    meta: {
      repositoryAlias: e
    }
  },
  {
    type: "treeItem",
    kind: "default",
    alias: "TagManager.TreeItem",
    name: "Tag Manager Tree Item",
    forEntityTypes: ["tagmanager-root", "tagmanager-group"]
  },
  {
    type: "workspace",
    kind: "routable",
    alias: "TagManager.GroupWorkspace",
    name: "Tag Group Workspace",
    api: () => import("./tag-group-workspace.context-VYCkSSTI.js"),
    meta: {
      entityType: "tagmanager-group"
    }
  },
  {
    type: "workspaceView",
    alias: "TagManager.GroupWorkspace.Tags",
    name: "Tag Group Tags View",
    element: () => import("./tag-group-workspace.element-D6J4ta08.js"),
    weight: 1e3,
    meta: {
      label: "Tags",
      pathname: "tags",
      icon: "icon-tags"
    },
    conditions: [
      {
        alias: "Umb.Condition.WorkspaceAlias",
        match: "TagManager.GroupWorkspace"
      }
    ]
  },
  {
    type: "workspace",
    kind: "default",
    alias: "TagManager.TagWorkspace",
    name: "Tag Manager Workspace",
    element: () => import("./tag-workspace.element-B-1W5B64.js"),
    meta: {
      entityType: "tagmanager-tag"
    }
  },
  {
    type: "workspaceView",
    alias: "TagManager.TagWorkspace.Edit",
    name: "Tag Edit Workspace View",
    element: () => import("./tag-edit-view.element-B8A-rxog.js"),
    weight: 300,
    meta: {
      label: "Edit",
      pathname: "edit",
      icon: "icon-edit"
    },
    conditions: [
      {
        alias: "Umb.Condition.WorkspaceAlias",
        match: "TagManager.TagWorkspace"
      }
    ]
  },
  {
    type: "modal",
    alias: "TagManager.Modal.CreateTag",
    name: "Create Tag Modal",
    js: () => import("./tag-create-modal.element-BtPKIxQX.js")
  }
], p = (n, a) => {
  a.registerMany(s);
};
export {
  g as U,
  p as o
};
//# sourceMappingURL=index-CoNCoqT9.js.map
