import Tree from '../../core/Tree';
import { isAlive, onSnapshot } from 'mobx-state-tree';
import { useEffect, useLayoutEffect, useState } from 'react';

export function Annotation({ annotation, root, store }) {
  useLayoutEffect(() => {
    return () => {
      if (annotation && isAlive(annotation)) {
        annotation.resetReady();
      }
    };
  }, [annotation.pk, annotation.id, store.adminsListLoading]);

  // if(shouldNotRender) return null;

  return root ? Tree.renderItem(root, annotation) : null;
}
