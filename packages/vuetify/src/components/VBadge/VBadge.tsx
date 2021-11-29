// Styles
import './VBadge.sass'

// Components
import { VIcon } from '@/components/VIcon'

// Composables
import { makeRoundedProps, useRounded } from '@/composables/rounded'
import { makeTagProps } from '@/composables/tag'
import { makeTransitionProps, MaybeTransition } from '@/composables/transition'
import { useBackgroundColor, useTextColor } from '@/composables/color'
import { useLocale } from '@/composables/locale'

// Utilities
import { computed, toRef } from 'vue'
import { convertToUnit, defineComponent, pick } from '@/util'
import { makeThemeProps, useTheme } from '@/composables/theme'
import { useRtl } from '@/composables/rtl'

export default defineComponent({
  name: 'VBadge',

  inheritAttrs: false,

  props: {
    bordered: Boolean,
    color: {
      type: String,
      default: 'primary',
    },
    content: String,
    dot: Boolean,
    floating: Boolean,
    icon: String,
    inline: Boolean,
    label: {
      type: String,
      default: '$vuetify.badge',
    },
    location: {
      type: String,
      default: 'top-right',
      validator: (value: string) => {
        const [vertical, horizontal] = (value ?? '').split('-')

        return (
          ['top', 'bottom'].includes(vertical) &&
          ['left', 'right'].includes(horizontal)
        )
      },
    },
    max: [Number, String],
    modelValue: {
      type: Boolean,
      default: true,
    },
    offsetX: [Number, String],
    offsetY: [Number, String],
    textColor: String,
    ...makeRoundedProps(),
    ...makeTagProps(),
    ...makeThemeProps(),
    ...makeTransitionProps({ transition: 'scale-rotate-transition' }),
  },

  setup (props, ctx) {
    const { backgroundColorClasses, backgroundColorStyles } = useBackgroundColor(toRef(props, 'color'))
    const { isRtl } = useRtl()
    const { roundedClasses } = useRounded(props, 'v-badge')
    const { t } = useLocale()
    const { textColorClasses, textColorStyles } = useTextColor(toRef(props, 'textColor'))
    const { themeClasses } = useTheme(props)

    const position = computed(() => {
      return props.floating
        ? (props.dot ? 2 : 4)
        : (props.dot ? 8 : 12)
    })

    function calculatePosition (offset?: number | string) {
      return `calc(100% - ${convertToUnit(position.value + parseInt(offset ?? 0, 10))})`
    }

    const locationStyles = computed(() => {
      const [vertical, horizontal] = (props.location ?? '').split('-')

      const styles = {
        bottom: 'auto',
        left: 'auto',
        right: 'auto',
        top: 'auto',
      }

      if (!props.inline) {
        const isRight = (isRtl.value && horizontal === 'right') || (!isRtl.value && horizontal === 'left')

        styles[isRight ? 'right' : 'left'] = calculatePosition(props.offsetX)
        styles[vertical === 'top' ? 'bottom' : 'top'] = calculatePosition(props.offsetY)
      }

      return styles
    })

    return () => {
      const value = Number(props.content)
      const content = (!props.max || isNaN(value)) ? props.content
        : value <= props.max ? value
        : `${props.max}+`

      const [badgeAttrs, attrs] = pick(ctx.attrs as Record<string, any>, [
        'aria-atomic',
        'aria-label',
        'aria-live',
        'role',
        'title',
      ])

      return (
        <props.tag
          class={[
            'v-badge',
            {
              'v-badge--bordered': props.bordered,
              'v-badge--dot': props.dot,
              'v-badge--floating': props.floating,
              'v-badge--inline': props.inline,
            },
          ]}
          { ...attrs }
        >
          <div class="v-badge__wrapper">
            { ctx.slots.default?.() }

            <MaybeTransition transition={ props.transition }>
              <span
                v-show={ props.modelValue }
                class={[
                  'v-badge__badge',
                  backgroundColorClasses.value,
                  roundedClasses.value,
                  textColorClasses.value,
                  themeClasses.value,
                ]}
                style={[
                  backgroundColorStyles.value,
                  locationStyles.value,
                  textColorStyles.value,
                ]}
                aria-atomic="true"
                aria-label={ t(props.label, value) }
                aria-live="polite"
                role="status"
                { ...badgeAttrs }
              >
                {
                  props.dot ? undefined
                  : ctx.slots.badge ? ctx.slots.badge?.()
                  : props.icon ? <VIcon icon={props.icon} />
                  : <span class="v-badge__content">{content}</span>
                }
              </span>
            </MaybeTransition>
          </div>
        </props.tag>
      )
    }
  },
})
