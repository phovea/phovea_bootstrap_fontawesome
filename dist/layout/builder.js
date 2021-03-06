import { EOrientation } from './interfaces';
import { ViewLayoutContainer, HTMLView, NodeView } from './internal/ViewLayoutContainer';
import { SplitLayoutContainer } from './internal/SplitLayoutContainer';
import { LineUpLayoutContainer } from './internal/LineUpLayoutContainer';
import { TabbingLayoutContainer } from './internal/TabbingLayoutContainer';
import { RootLayoutContainer } from './internal/RootLayoutContainer';
export class ABuilder {
    constructor() {
        this._name = 'View';
        this._fixed = false;
        this._autoWrap = false;
        this._fixedLayout = false;
    }
    /**
     * specify the name of the view
     * @param {string} name the new name
     * @return {this} itself
     */
    name(name) {
        this._name = name;
        return this;
    }
    /**
     * specify that the view cannot be closed and the view and separators cannot be moved via drag and drop
     * setting the fixed option implies the fixedLayout option
     * @return {this} itself
     */
    fixed() {
        this._fixed = true;
        this._fixedLayout = true;
        return this;
    }
    /**
     * specify that drag and drop is disabled for views, but the separator can still be moved
     * @returns {this}
     */
    fixedLayout() {
        this._fixedLayout = true;
        return this;
    }
    /**
     * specify that the view should be automatically wrapped with a tabbing container in case of a new split
     * @return {this} itself
     */
    autoWrap(name) {
        this._autoWrap = name !== undefined ? name : true;
        return this;
    }
    buildOptions() {
        return {
            name: this._name,
            fixed: this._fixed,
            autoWrap: this._autoWrap,
            fixedLayout: this._fixedLayout
        };
    }
}
export class ViewBuilder extends ABuilder {
    constructor(view) {
        super();
        this.view = view;
        this._hideHeader = false;
    }
    hideHeader() {
        this._hideHeader = true;
        this._fixed = true;
        return this;
    }
    buildOptions() {
        return Object.assign({
            hideHeader: this._hideHeader
        }, super.buildOptions());
    }
    build(root, doc) {
        const options = this.buildOptions();
        if (typeof this.view === 'string') {
            return new ViewLayoutContainer(new HTMLView(this.view, doc), options);
        }
        if (this.view.nodeName !== undefined) {
            return new ViewLayoutContainer(new NodeView(this.view), options);
        }
        return new ViewLayoutContainer(this.view, options);
    }
}
export class LayoutUtils {
    /**
     * restores the given layout dump
     * @param {ILayoutDump} dump the dump
     * @param {(referenceId: number) => IView} restoreView lookup function for getting the underlying view given the dumped reference id
     * @param {Document} doc root document
     * @return {ILayoutContainer} the root element
     */
    static restore(dump, restoreView, doc = document) {
        const restorer = (d) => LayoutUtils.restore(d, restoreView, doc);
        switch (dump.type) {
            case 'root':
                return RootLayoutContainer.restore(dump, doc, (r, child) => this.toBuilder(child).build(r, doc), (dump, restoreView) => LayoutUtils.restore(dump, restoreView, doc), restoreView);
            case 'split':
                return SplitLayoutContainer.restore(dump, restorer, doc);
            case 'lineup':
                return LineUpLayoutContainer.restore(dump, restorer, doc);
            case 'tabbing':
                return TabbingLayoutContainer.restore(dump, restorer, doc);
            case 'view':
                return ViewLayoutContainer.restore(dump, restoreView, doc);
            default:
                throw new Error(`invalid type: ${dump.type}`);
        }
    }
    /**
     * derives from an existing html scaffolded layout the phovea layout and replaced the nodes with it
     * @param {HTMLElement} node the root node
     * @param {(node: HTMLElement) => IView} viewFactory how to build a view from a node
     */
    static derive(node, viewFactory = (node) => new NodeView(node)) {
        const doc = node.ownerDocument;
        const r = new RootLayoutContainer(doc, (child) => this.toBuilder(child).build(r, doc), (dump, restoreView) => LayoutUtils.restore(dump, restoreView, doc));
        const deriveImpl = (node) => {
            switch (node.dataset.layout || 'view') {
                case 'hsplit':
                case 'vsplit':
                case 'split':
                    return SplitLayoutContainer.derive(node, deriveImpl);
                case 'lineup':
                case 'vlineup':
                case 'hlineup':
                case 'stack':
                case 'hstack':
                case 'vstack':
                    return LineUpLayoutContainer.derive(node, deriveImpl);
                case 'tabbing':
                    return TabbingLayoutContainer.derive(node, deriveImpl);
                default:
                    // interpret as view
                    return ViewLayoutContainer.derive(viewFactory(node) || new NodeView(node));
            }
        };
        r.root = deriveImpl(node);
        if (node.parentElement) {
            //replace old node with new root
            node.parentElement.replaceChild(r.node, node);
        }
        return r;
    }
    static toBuilder(view) {
        if (view instanceof ABuilder) {
            return view;
        }
        return new ViewBuilder(view);
    }
}
export class AParentBuilder extends ABuilder {
    constructor(children) {
        super();
        this.children = [];
        this._name = '';
        children.forEach((c) => this.push(c));
    }
    push(view) {
        this.children.push(LayoutUtils.toBuilder(view));
        return this;
    }
    buildChildren(root, doc) {
        return this.children.map((c) => c.build(root, doc));
    }
}
export class SplitBuilder extends AParentBuilder {
    constructor(orientation, ratio, left, right) {
        super([left, right]);
        this.orientation = orientation;
        this._ratio = 0.5;
        this._ratio = ratio;
    }
    /**
     * set the ratio between the left and right view
     * @param {number} ratio the new ratio
     * @return {SplitBuilder} itself
     */
    ratio(ratio) {
        this._ratio = ratio;
        return this;
    }
    buildOptions() {
        return Object.assign({
            orientation: this.orientation,
        }, super.buildOptions());
    }
    build(root, doc = document) {
        const built = this.buildChildren(root, doc);
        console.assert(built.length >= 2);
        const r = new SplitLayoutContainer(doc, this.buildOptions(), this._ratio, built[0], built[1]);
        built.slice(2).forEach((c) => r.push(c));
        return r;
    }
}
class LineUpBuilder extends AParentBuilder {
    constructor(orientation, children, stackLayout = false) {
        super(children);
        this.orientation = orientation;
        this.stackLayout = stackLayout;
    }
    /**
     * push another child
     * @param {IBuildAbleOrViewLike} view the view to add
     * @return {LineUpBuilder} itself
     */
    push(view) {
        return super.push(view);
    }
    buildOptions() {
        return Object.assign({
            orientation: this.orientation,
            stackLayout: this.stackLayout
        }, super.buildOptions());
    }
    build(root, doc = document) {
        const built = this.buildChildren(root, doc);
        return new LineUpLayoutContainer(doc, this.buildOptions(), ...built);
    }
}
class TabbingBuilder extends AParentBuilder {
    constructor() {
        super(...arguments);
        this._active = null;
    }
    /**
     * push another tab
     * @param {IBuildAbleOrViewLike} view the tab
     * @return {TabbingBuilder} itself
     */
    push(view) {
        return super.push(view);
    }
    /**
     * adds another child and specify it should be the active one
     * @param {IBuildAbleOrViewLike} view the active tab
     * @return {AParentBuilder} itself
     */
    active(view) {
        this._active = this.children.length;
        return super.push(view);
    }
    buildOptions() {
        return Object.assign({
            active: this._active
        }, super.buildOptions());
    }
    build(root, doc) {
        const built = this.buildChildren(root, doc);
        return new TabbingLayoutContainer(doc, this.buildOptions(), ...built);
    }
}
export class BuilderUtils {
    /**
     * builder for creating a view
     * @param {string | IView} view possible view content
     * @return {ViewBuilder} a view builder
     */
    static view(view) {
        return new ViewBuilder(view);
    }
    /**
     * creates the root of a new layout
     * @param {IBuildAbleOrViewLike} child the only child of the root
     * @param {Document} doc root Document
     * @return {IRootLayoutContainer} the root element
     */
    static root(child, doc = document) {
        const b = LayoutUtils.toBuilder(child);
        const r = new RootLayoutContainer(doc, (child) => LayoutUtils.toBuilder(child).build(r, doc), (dump, restoreView) => LayoutUtils.restore(dump, restoreView, doc));
        r.root = b.build(r, doc);
        return r;
    }
    /**
     * builder for creating a horizontal split layout (moveable splitter)
     * @param {number} ratio ratio between the two given elements
     * @param {IBuildAbleOrViewLike} left left container
     * @param {IBuildAbleOrViewLike} right right container
     * @return {SplitBuilder} a split builder
     */
    static horizontalSplit(ratio, left, right) {
        return new SplitBuilder(EOrientation.HORIZONTAL, ratio, left, right);
    }
    /**
     * builder for creating a vertical split layout (moveable splitter)
     * @param {number} ratio ratio between the two given elements
     * @param {IBuildAbleOrViewLike} left left container
     * @param {IBuildAbleOrViewLike} right right container
     * @return {SplitBuilder} a split builder
     */
    static verticalSplit(ratio, left, right) {
        return new SplitBuilder(EOrientation.VERTICAL, ratio, left, right);
    }
    /**
     * builder for creating a horizontal lineup layout (each container has the same full size with scrollbars)
     * @param {IBuildAbleOrViewLike} children the children of the layout
     * @return {LineUpBuilder} a lineup builder
     */
    static horizontalLineUp(...children) {
        return new LineUpBuilder(EOrientation.HORIZONTAL, children);
    }
    /**
     * builder for creating a vertical lineup layout (each container has the same full size with scrollbars)
     * @param {IBuildAbleOrViewLike} children the children of the layout
     * @return {LineUpBuilder} a lineup builder
     */
    static verticalLineUp(...children) {
        return new LineUpBuilder(EOrientation.VERTICAL, children);
    }
    /**
     * similar to the horizontalLineUp, except that each container takes its own amount of space
     * @param {IBuildAbleOrViewLike} children the children of the layout
     * @return {LineUpBuilder} a lineup builder
     */
    static horizontalStackedLineUp(...children) {
        return new LineUpBuilder(EOrientation.HORIZONTAL, children, true);
    }
    /**
     * similar to the verticalLineUp, except that each container takes its own amount of space
     * @param {IBuildAbleOrViewLike} children the children of the layout
     * @return {LineUpBuilder} a lineup builder
     */
    static verticalStackedLineUp(...children) {
        return new LineUpBuilder(EOrientation.VERTICAL, children, true);
    }
    /**
     * builder for creating a tab layout
     * @param {IBuildAbleOrViewLike} children the children of the layout
     * @return {TabbingBuilder} a tabbing builder
     */
    static tabbing(...children) {
        return new TabbingBuilder(children);
    }
}
//# sourceMappingURL=builder.js.map