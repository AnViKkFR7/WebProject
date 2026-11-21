import { Link } from 'react-router-dom'
import styles from './DocumentActionButton.module.css'

export default function DocumentActionButton({variant='solid',className='',type='button',children,...props}) {
  return <button type={type} className={`${styles.button} ${styles[variant]} ${className}`.trim()} {...props}>{children}</button>
}

/** Mismo aspecto que DocumentActionButton para acciones que llevan a otro documento. */
export function DocumentActionLink({variant='outline',className='',children,...props}) {
  return <Link className={`${styles.button} ${styles[variant]} ${className}`.trim()} {...props}>{children}</Link>
}
