import { useState, useEffect, useRef } from 'react'

const DatePicker = ({ value, onChange, disabled, required }) => {
  const [showPicker, setShowPicker] = useState(false)
  const [selectedDate, setSelectedDate] = useState(value || '')
  const [displayMonth, setDisplayMonth] = useState(new Date())
  const pickerRef = useRef(null)

  useEffect(() => {
    setSelectedDate(value || '')
  }, [value])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowPicker(false)
      }
    }

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showPicker])

  const formatDate = (dateString) => {
    if (!dateString) return 'Seleccionar fecha...'
    const date = new Date(dateString + 'T00:00:00')
    return date.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    })
  }

  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    
    return { daysInMonth, startingDayOfWeek, year, month }
  }

  const handleDateClick = (day) => {
    const year = displayMonth.getFullYear()
    const month = displayMonth.getMonth()
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setSelectedDate(dateString)
    onChange(dateString)
    setShowPicker(false)
  }

  const handlePrevMonth = () => {
    setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1))
  }

  const handleNextMonth = () => {
    setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1))
  }

  const handleClear = (e) => {
    e.stopPropagation()
    setSelectedDate('')
    onChange(null)
    setShowPicker(false)
  }

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(displayMonth)
  const days = []
  
  // Empty cells before first day
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="date-picker-day empty"></div>)
  }
  
  // Days of month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const isSelected = dateString === selectedDate
    const isToday = dateString === new Date().toISOString().split('T')[0]
    
    days.push(
      <div
        key={day}
        className={`date-picker-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
        onClick={() => handleDateClick(day)}
      >
        {day}
      </div>
    )
  }

  return (
    <div className="date-picker-wrapper" ref={pickerRef}>
      <div 
        className={`date-picker-input ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setShowPicker(!showPicker)}
      >
        <span className={selectedDate ? '' : 'placeholder'}>
          {formatDate(selectedDate)}
        </span>
        <div style={{ display: 'flex', gap: '0.25rem', marginLeft: 'auto' }}>
          {selectedDate && !disabled && (
            <button
              type="button"
              className="date-picker-clear"
              onClick={handleClear}
              title="Limpiar"
            >
              ✕
            </button>
          )}
          <span className="date-picker-icon">📅</span>
        </div>
      </div>

      {showPicker && (
        <div className="date-picker-dropdown">
          <div className="date-picker-header">
            <button type="button" onClick={handlePrevMonth} className="date-picker-nav">
              ‹
            </button>
            <div className="date-picker-month">
              {displayMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
            </div>
            <button type="button" onClick={handleNextMonth} className="date-picker-nav">
              ›
            </button>
          </div>
          
          <div className="date-picker-weekdays">
            {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((day, i) => (
              <div key={i} className="date-picker-weekday">{day}</div>
            ))}
          </div>
          
          <div className="date-picker-days">
            {days}
          </div>
        </div>
      )}
    </div>
  )
}

export default DatePicker
