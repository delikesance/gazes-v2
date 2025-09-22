export default defineEventHandler(async (event) => {
    return { message: 'Test route works', params: event.context.params }
})