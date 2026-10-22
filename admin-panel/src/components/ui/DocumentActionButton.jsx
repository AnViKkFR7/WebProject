import styles from './DocumentActionButton.module.css'

export default function DocumentActionButton({variant='solid',className='',type='button',children,...props}) {
  return <button type={type} className={`${styles.button} ${styles[variant]} ${className}`.trim()} {...props}>{children}</button>
}
