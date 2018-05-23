import {AParentLayoutContainer} from './AParentLayoutContainer';
import {ILayoutContainer, ISize, ILayoutDump} from '../interfaces';
import {ILayoutContainerOption} from './ALayoutContainer';
import {EOrientation, IDropArea} from './interfaces';

export interface ISequentialLayoutContainerOptions extends ILayoutContainerOption {
  readonly orientation: EOrientation;
}

export abstract class ASequentialLayoutContainer<T extends ISequentialLayoutContainerOptions> extends AParentLayoutContainer<T> {
  constructor(document: Document, options: Partial<T>) {
    super(document, options);

    this.node.dataset.layout = 'sequence';
    this.node.dataset.orientation = this.options.orientation === EOrientation.HORIZONTAL ? 'h' : 'v';
  }

  canDrop(area: IDropArea) {
    return this.options.orientation === EOrientation.HORIZONTAL ? (area === 'left' || area === 'right' || area === 'horizontal-scroll') : (area === 'top' || area === 'bottom' || area === 'vertical-scroll');
  }

  defaultOptions() {
    return Object.assign(super.defaultOptions(), {
      orientation: EOrientation.HORIZONTAL
    });
  }

  get hideAbleHeader() {
    return this.options.fixedLayout;
  }

  protected getPadding() {
    return 0;
  }

  get minSize() {
    console.assert(this.length >= 1);
    const padding = this.getPadding();
    switch (this.options.orientation) {
      case EOrientation.HORIZONTAL:
        return <ISize>this._children.reduce((a, c) => {
          const cmin = c.minSize;
          return [a[0] + cmin[0], Math.max(a[1], cmin[1])];
        }, [padding, 0]);
      case EOrientation.VERTICAL: {
        return <ISize>this._children.reduce((a, c) => {
          const cmin = c.minSize;
          return [Math.max(a[0], cmin[0]), a[1] + cmin[1]];
        }, [0, padding]);
      }
    }
  }

  persist(): ILayoutDump {
    return Object.assign(super.persist(), {
      type: 'sequence',
      orientation: EOrientation[this.options.orientation]
    });
  }
}

export default ASequentialLayoutContainer;

export function wrap(child: ILayoutContainer) {
  const s = child.node.ownerDocument.createElement('section');
  if (!child.hideAbleHeader) {
    s.appendChild(child.header);
  }
  s.appendChild(child.node);
  return s;
}
