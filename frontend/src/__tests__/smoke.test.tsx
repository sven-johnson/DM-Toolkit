import { render, screen } from '@testing-library/react'

test('smoke: test harness renders', () => {
  render(<div>ok</div>)
  expect(screen.getByText('ok')).toBeInTheDocument()
})
