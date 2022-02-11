import { useProxiedModel } from '@/composables/proxiedModel'
import { getUid, propsFactory } from '@/util'
import { computed, inject, onBeforeUnmount, provide, ref } from 'vue'
import { multipleOpenStrategy, singleOpenStrategy } from './openStrategies'
import { classicSelectStrategy, independentSelectStrategy, leafSelectStrategy } from './selectStrategies'

// Types
import type { InjectionKey, Prop, Ref } from 'vue'
import type { SelectStrategyFn } from './selectStrategies'
import type { OpenStrategyFn } from './openStrategies'

export type SelectStrategy = 'single-leaf' | 'leaf' | 'independent' | 'classic' | SelectStrategyFn
export type OpenStrategy = 'single' | 'multiple' | OpenStrategyFn

export interface NestedProps {
  selectStrategy: SelectStrategy | undefined
  openStrategy: OpenStrategy | undefined
  selected: string[] | undefined
  opened: string[] | undefined
  'onUpdate:selected': ((val: string[]) => void) | undefined
  'onUpdate:opened': ((val: string[]) => void) | undefined
}

type NestedProvide = {
  id: Ref<string | null>
  root: {
    children: Ref<Map<string, string[]>>
    parents: Ref<Map<string, string>>
    opened: Ref<Set<string>>
    selected: Ref<Map<string, 'on' | 'off' | 'indeterminate'>>
    selectedValues: Ref<string[]>
    register: (id: string, parentId: string | null, isGroup?: boolean) => void
    unregister: (id: string) => void
    open: (id: string, value: boolean, event?: Event) => void
    select: (id: string, value: boolean, event?: Event) => void
  }
}

export const VNestedSymbol: InjectionKey<NestedProvide> = Symbol.for('vuetify:nested')

export const emptyNested: NestedProvide = {
  id: ref(null),
  root: {
    register: () => null,
    unregister: () => null,
    parents: ref(new Map()),
    children: ref(new Map()),
    open: () => null,
    select: () => null,
    opened: ref(new Set()),
    selected: ref(new Map()),
    selectedValues: ref([]),
  },
}

export const makeNestedProps = propsFactory({
  selectStrategy: [String, Function] as Prop<SelectStrategy>,
  openStrategy: [String, Function] as Prop<OpenStrategy>,
  opened: Array as Prop<string[]>,
  selected: Array as Prop<string[]>,
}, 'nested')

export const useNested = (props: NestedProps) => {
  let isUnmounted = false
  const children = ref(new Map<string, string[]>())
  const parents = ref(new Map<string, string>())

  const opened = useProxiedModel(props, 'opened', props.opened, v => new Set(v), v => [...v.values()])

  const selectStrategy = computed(() => {
    if (typeof props.selectStrategy === 'object') return props.selectStrategy

    switch (props.selectStrategy) {
      case 'single-leaf': return leafSelectStrategy(true)
      case 'leaf': return leafSelectStrategy()
      case 'independent': return independentSelectStrategy
      case 'classic':
      default: return classicSelectStrategy
    }
  })

  const openStrategy = computed(() => {
    if (typeof props.openStrategy === 'function') return props.openStrategy

    switch (props.openStrategy) {
      case 'single': return singleOpenStrategy
      case 'multiple':
      default: return multipleOpenStrategy
    }
  })

  const selected = useProxiedModel(
    props,
    'selected',
    props.selected,
    v => selectStrategy.value.in(v, children.value, parents.value),
    v => selectStrategy.value.out(v, children.value, parents.value),
  )

  onBeforeUnmount(() => {
    isUnmounted = true
  })

  const nested: NestedProvide = {
    id: ref(null),
    root: {
      opened,
      selected,
      selectedValues: computed(() => {
        const arr = []

        for (const [key, value] of selected.value.entries()) {
          if (value === 'on') arr.push(key)
        }

        return arr
      }),
      register: (id, parentId, isGroup) => {
        parentId && id !== parentId && parents.value.set(id, parentId)

        isGroup && children.value.set(id, [])

        if (parentId != null) {
          children.value.set(parentId, [...children.value.get(parentId) || [], id])
        }
      },
      unregister: id => {
        if (isUnmounted) return

        children.value.delete(id)
        const parent = parents.value.get(id)
        if (parent) {
          const list = children.value.get(parent) ?? []
          children.value.set(parent, list.filter(child => child !== id))
        }
        parents.value.delete(id)
        opened.value.delete(id)
        selected.value.delete(id)
      },
      open: (id, value, event) => {
        const newOpened = openStrategy.value({
          id,
          value,
          opened: new Set(opened.value),
          children: children.value,
          parents: parents.value,
          event,
        })

        newOpened && (opened.value = newOpened)
      },
      select: (id, value, event) => {
        const newSelected = selectStrategy.value.select({
          id,
          value,
          selected: new Map(selected.value),
          children: children.value,
          parents: parents.value,
          event,
        })

        newSelected && (selected.value = newSelected)
      },
      children,
      parents,
    },
  }

  provide(VNestedSymbol, nested)

  return nested.root
}

export const useNestedItem = (id: Ref<string | undefined>) => {
  const parent = inject(VNestedSymbol, emptyNested)

  const computedId = computed(() => id.value ?? getUid().toString())

  const item = {
    ...parent,
    id: computedId,
    parent: computed(() => parent.root.parents.value.get(computedId.value)),
    select: (selected: boolean, e: Event) => parent.root.select(computedId.value, selected, e),
    isSelected: computed(() => parent.root.selected.value.get(computedId.value) === 'on'),
  }

  parent.root.register(computedId.value, parent.id.value, false)

  onBeforeUnmount(() => {
    parent.root.unregister(computedId.value)
  })

  return item
}

export const useNestedGroup = () => {
  const parent = inject(VNestedSymbol, emptyNested)

  const id = computed(() => getUid().toString())

  const group = {
    ...parent,
    id,
    open: (open: boolean, e: Event) => parent.root.open(id.value, open, e),
    isOpen: computed(() => parent.root.opened.value.has(id.value)),
    isSelected: computed(() => parent.root.selected.value.get(id.value) === 'on'),
    isIndeterminate: computed(() => parent.root.selected.value.get(id.value) === 'indeterminate'),
  }

  parent.root.register(id.value, parent.id.value, true)

  onBeforeUnmount(() => {
    parent.root.unregister(id.value)
  })

  provide(VNestedSymbol, group)

  return group
}
