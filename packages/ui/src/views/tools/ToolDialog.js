import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from 'store/actions'
import { cloneDeep } from 'lodash'

import { Box, Typography, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, OutlinedInput } from '@mui/material'
import { StyledButton } from 'ui-component/button/StyledButton'
import { Grid } from 'ui-component/grid/Grid'
import { TooltipWithParser } from 'ui-component/tooltip/TooltipWithParser'
import { GridActionsCellItem } from '@mui/x-data-grid'
import DeleteIcon from '@mui/icons-material/Delete'
import ConfirmDialog from 'ui-component/dialog/ConfirmDialog'
import { CodeEditor } from 'ui-component/editor/CodeEditor'
import HowToUseFunctionDialog from './HowToUseFunctionDialog'

// Icons
import { IconX, IconFileExport } from '@tabler/icons'

// API
import toolsApi from 'api/tools'

// Hooks
import useConfirm from 'hooks/useConfirm'
import useApi from 'hooks/useApi'

// utils
import useNotifier from 'utils/useNotifier'
import { generateRandomGradient, formatDataGridRows } from 'utils/genericHelper'
import { HIDE_CANVAS_DIALOG, SHOW_CANVAS_DIALOG } from 'store/actions'
import { translationObject } from 'translate'

const exampleAPIFunc = `/*
* Вы можете использовать любые библиотеки, импортированные в StartAI.
* Вы можете использовать свойства, указанные в схеме вывода, в качестве переменных. Пример: Свойство = идентификатор пользователя, переменная = $userid.
* Вы можете получить конфигурацию потока по умолчанию: $flow.sessionId, $flow.chatId, $flow.chatflowId, $flow.input.
* Вы можете получить пользовательские переменные: $vars.<имя-переменной>
* Должно возвращать строковое значение в конце функции.
*/

const fetch = require('node-fetch');
const url = 'https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current_weather=true';
const options = {
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
};
try {
    const response = await fetch(url, options);
    const text = await response.text();
    return text;
} catch (error) {
    console.error(error);
    return '';
}`

const ToolDialog = ({ show, dialogProps, onUseTemplate, onCancel, onConfirm }) => {
    const portalElement = document.getElementById('portal')

    const customization = useSelector((state) => state.customization)
    const dispatch = useDispatch()

    // ==============================|| Snackbar ||============================== //

    useNotifier()
    const { confirm } = useConfirm()

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const getSpecificToolApi = useApi(toolsApi.getSpecificTool)

    const [toolId, setToolId] = useState('')
    const [toolName, setToolName] = useState('')
    const [toolDesc, setToolDesc] = useState('')
    const [toolIcon, setToolIcon] = useState('')
    const [toolSchema, setToolSchema] = useState([])
    const [toolFunc, setToolFunc] = useState('')
    const [showHowToDialog, setShowHowToDialog] = useState(false)

    const deleteItem = useCallback(
        (id) => () => {
            setTimeout(() => {
                setToolSchema((prevRows) => prevRows.filter((row) => row.id !== id))
            })
        },
        []
    )

    const addNewRow = () => {
        setTimeout(() => {
            setToolSchema((prevRows) => {
                let allRows = [...cloneDeep(prevRows)]
                const lastRowId = allRows.length ? allRows[allRows.length - 1].id + 1 : 1
                allRows.push({
                    id: lastRowId,
                    property: '',
                    description: '',
                    type: '',
                    required: false
                })
                return allRows
            })
        })
    }

    const onRowUpdate = (newRow) => {
        setTimeout(() => {
            setToolSchema((prevRows) => {
                let allRows = [...cloneDeep(prevRows)]
                const indexToUpdate = allRows.findIndex((row) => row.id === newRow.id)
                if (indexToUpdate >= 0) {
                    allRows[indexToUpdate] = { ...newRow }
                }
                return allRows
            })
        })
    }

    const columns = useMemo(
        () => [
            { field: 'property', headerName: 'Свойство', editable: true, flex: 1 },
            {
                field: 'type',
                headerName: 'Тип',
                type: 'singleSelect',
                valueOptions: ['string', 'number', 'boolean', 'date'],
                editable: true,
                width: 120
            },
            { field: 'description', headerName: 'Описание', editable: true, flex: 1 },
            { field: 'required', headerName: 'Обязательное', type: 'boolean', editable: true, width: 80 },
            {
                field: 'actions',
                type: 'actions',
                width: 80,
                getActions: (params) => [
                    <GridActionsCellItem key={'Delete'} icon={<DeleteIcon />} label='Delete' onClick={deleteItem(params.id)} />
                ]
            }
        ],
        [deleteItem]
    )

    useEffect(() => {
        if (show) dispatch({ type: SHOW_CANVAS_DIALOG })
        else dispatch({ type: HIDE_CANVAS_DIALOG })
        return () => dispatch({ type: HIDE_CANVAS_DIALOG })
    }, [show, dispatch])

    useEffect(() => {
        if (getSpecificToolApi.data) {
            setToolId(getSpecificToolApi.data.id)
            setToolName(getSpecificToolApi.data.name)
            setToolDesc(getSpecificToolApi.data.description)
            setToolSchema(formatDataGridRows(getSpecificToolApi.data.schema))
            if (getSpecificToolApi.data.func) setToolFunc(getSpecificToolApi.data.func)
            else setToolFunc('')
        }
    }, [getSpecificToolApi.data])

    useEffect(() => {
        if (dialogProps.type === 'EDIT' && dialogProps.data) {
            // When tool dialog is opened from Tools dashboard
            setToolId(dialogProps.data.id)
            setToolName(dialogProps.data.name)
            setToolDesc(dialogProps.data.description)
            setToolIcon(dialogProps.data.iconSrc)
            setToolSchema(formatDataGridRows(dialogProps.data.schema))
            if (dialogProps.data.func) setToolFunc(dialogProps.data.func)
            else setToolFunc('')
        } else if (dialogProps.type === 'EDIT' && dialogProps.toolId) {
            // When tool dialog is opened from CustomTool node in canvas
            getSpecificToolApi.request(dialogProps.toolId)
        } else if (dialogProps.type === 'IMPORT' && dialogProps.data) {
            // When tool dialog is to import existing tool
            setToolName(dialogProps.data.name)
            setToolDesc(dialogProps.data.description)
            setToolIcon(dialogProps.data.iconSrc)
            setToolSchema(formatDataGridRows(dialogProps.data.schema))
            if (dialogProps.data.func) setToolFunc(dialogProps.data.func)
            else setToolFunc('')
        } else if (dialogProps.type === 'TEMPLATE' && dialogProps.data) {
            // When tool dialog is a template
            setToolName(dialogProps.data.name)
            setToolDesc(dialogProps.data.description)
            setToolIcon(dialogProps.data.iconSrc)
            setToolSchema(formatDataGridRows(dialogProps.data.schema))
            if (dialogProps.data.func) setToolFunc(dialogProps.data.func)
            else setToolFunc('')
        } else if (dialogProps.type === 'ADD') {
            // When tool dialog is to add a new tool
            setToolId('')
            setToolName('')
            setToolDesc('')
            setToolIcon('')
            setToolSchema([])
            setToolFunc('')
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dialogProps])

    const useToolTemplate = () => {
        onUseTemplate(dialogProps.data)
    }

    const exportTool = async () => {
        try {
            const toolResp = await toolsApi.getSpecificTool(toolId)
            if (toolResp.data) {
                const toolData = toolResp.data
                delete toolData.id
                delete toolData.createdDate
                delete toolData.updatedDate
                let dataStr = JSON.stringify(toolData, null, 2)
                let dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)

                let exportFileDefaultName = `${toolName}-CustomTool.json`

                let linkElement = document.createElement('a')
                linkElement.setAttribute('href', dataUri)
                linkElement.setAttribute('download', exportFileDefaultName)
                linkElement.click()
            }
        } catch (error) {
            const errorData = error.response.data || `${error.response.status}: ${error.response.statusText}`
            enqueueSnackbar({
                message: `Ошибка отправки инструмента ${errorData}`,
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error',
                    persist: true,
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            <IconX />
                        </Button>
                    )
                }
            })
            onCancel()
        }
    }

    const addNewTool = async () => {
        try {
            const obj = {
                name: toolName,
                description: toolDesc,
                color: generateRandomGradient(),
                schema: JSON.stringify(toolSchema),
                func: toolFunc,
                iconSrc: toolIcon
            }
            const createResp = await toolsApi.createNewTool(obj)
            if (createResp.data) {
                enqueueSnackbar({
                    message: 'Новый инструмент добавлен',
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'success',
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
                onConfirm(createResp.data.id)
            }
        } catch (error) {
            const errorData = error.response.data || `${error.response.status}: ${error.response.statusText}`
            enqueueSnackbar({
                message: `Ошибка удаления инструмента: ${errorData}`,
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error',
                    persist: true,
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            <IconX />
                        </Button>
                    )
                }
            })
            onCancel()
        }
    }

    const saveTool = async () => {
        try {
            const saveResp = await toolsApi.updateTool(toolId, {
                name: toolName,
                description: toolDesc,
                schema: JSON.stringify(toolSchema),
                func: toolFunc,
                iconSrc: toolIcon
            })
            if (saveResp.data) {
                enqueueSnackbar({
                    message: 'Tool saved',
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'success',
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
                onConfirm(saveResp.data.id)
            }
        } catch (error) {
            console.error(error)
            const errorData = error.response.data || `${error.response.status}: ${error.response.statusText}`
            enqueueSnackbar({
                message: `Failed to save Tool: ${errorData}`,
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error',
                    persist: true,
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            <IconX />
                        </Button>
                    )
                }
            })
            onCancel()
        }
    }

    const deleteTool = async () => {
        const confirmPayload = {
            title: `Удалить инструмент`,
            description: `Удалить инструмент ${toolName}?`,
            confirmButtonName: 'Удалить',
            cancelButtonName: 'Отмена'
        }
        const isConfirmed = await confirm(confirmPayload)

        if (isConfirmed) {
            try {
                const delResp = await toolsApi.deleteTool(toolId)
                if (delResp.data) {
                    enqueueSnackbar({
                        message: 'Инструмент удален',
                        options: {
                            key: new Date().getTime() + Math.random(),
                            variant: 'success',
                            action: (key) => (
                                <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                    <IconX />
                                </Button>
                            )
                        }
                    })
                    onConfirm()
                }
            } catch (error) {
                const errorData = error.response.data || `${error.response.status}: ${error.response.statusText}`
                enqueueSnackbar({
                    message: `Ошибка удаления инструмента: ${errorData}`,
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'error',
                        persist: true,
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
                onCancel()
            }
        }
    }

    const component = show ? (
        <Dialog
            fullWidth
            maxWidth='md'
            open={show}
            onClose={onCancel}
            aria-labelledby='alert-dialog-title'
            aria-describedby='alert-dialog-description'
        >
            <DialogTitle sx={{ fontSize: '1rem' }} id='alert-dialog-title'>
                <div style={{ display: 'flex', flexDirection: 'row' }}>
                    {dialogProps.title}
                    <div style={{ flex: 1 }} />
                    {dialogProps.type === 'EDIT' && (
                        <Button variant='outlined' onClick={() => exportTool()} startIcon={<IconFileExport />}>
                            Отправить
                        </Button>
                    )}
                </div>
            </DialogTitle>
            <DialogContent>
                <Box sx={{ p: 2 }}>
                    <Stack sx={{ position: 'relative' }} direction='row'>
                        <Typography variant='overline'>
                            Название команды
                            <span style={{ color: 'red' }}>&nbsp;*</span>
                            <TooltipWithParser
                                style={{ marginLeft: 10 }}
                                title={
                                    translationObject[
                                        'Название инструмента должно состоять из маленькой заглавной буквы и подчеркивания. Пример: мой_инструмент'
                                    ] || ''
                                }
                            />
                        </Typography>
                    </Stack>
                    <OutlinedInput
                        id='toolName'
                        type='string'
                        fullWidth
                        disabled={dialogProps.type === 'TEMPLATE'}
                        placeholder='Мой новый инструмент'
                        value={toolName}
                        name='toolName'
                        onChange={(e) => setToolName(e.target.value)}
                    />
                </Box>
                <Box sx={{ p: 2 }}>
                    <Stack sx={{ position: 'relative' }} direction='row'>
                        <Typography variant='overline'>
                            Описание команды
                            <span style={{ color: 'red' }}>&nbsp;*</span>
                            <TooltipWithParser
                                style={{ marginLeft: 10 }}
                                title={
                                    translationObject[
                                        'Описание того, что делает инструмент. ChatGPT определяет, когда использовать этот инструмент.'
                                    ] || ''
                                }
                            />
                        </Typography>
                    </Stack>
                    <OutlinedInput
                        id='toolDesc'
                        type='string'
                        fullWidth
                        disabled={dialogProps.type === 'TEMPLATE'}
                        placeholder='Описание того, что делает инструмент. ChatGPT определяет, когда использовать этот инструмент.'
                        multiline={true}
                        rows={3}
                        value={toolDesc}
                        name='toolDesc'
                        onChange={(e) => setToolDesc(e.target.value)}
                    />
                </Box>
                <Box sx={{ p: 2 }}>
                    <Stack sx={{ position: 'relative' }} direction='row'>
                        <Typography variant='overline'>Иконка команды</Typography>
                    </Stack>
                    <OutlinedInput
                        id='toolIcon'
                        type='string'
                        fullWidth
                        disabled={dialogProps.type === 'TEMPLATE'}
                        placeholder='https://raw.githubusercontent.com/gilbarbara/logos/main/logos/airtable.svg'
                        value={toolIcon}
                        name='toolIcon'
                        onChange={(e) => setToolIcon(e.target.value)}
                    />
                </Box>
                <Box sx={{ p: 2 }}>
                    <Stack sx={{ position: 'relative' }} direction='row'>
                        <Typography variant='overline'>
                            Схема вывода
                            <TooltipWithParser style={{ marginLeft: 10 }} title={'Каким должен быть выходной ответ в формате JSON?'} />
                        </Typography>
                    </Stack>
                    <Grid
                        columns={columns}
                        rows={toolSchema}
                        disabled={dialogProps.type === 'TEMPLATE'}
                        addNewRow={addNewRow}
                        onRowUpdate={onRowUpdate}
                    />
                </Box>
                <Box sx={{ p: 2 }}>
                    <Stack sx={{ position: 'relative' }} direction='row'>
                        <Typography variant='overline'>
                            Функция Javascript
                            <TooltipWithParser
                                style={{ marginLeft: 10 }}
                                title='Функция, выполняемая при использовании инструмента. Вы можете использовать свойства, указанные в схеме вывода, в качестве переменных. Например, если свойство имеет вид <code>userid</code>, вы можете использовать его как <code>$userid</code>. Возвращаемое значение должно быть строкой.'
                            />
                        </Typography>
                    </Stack>
                    <Button
                        style={{ marginBottom: 10, marginRight: 10 }}
                        color='secondary'
                        variant='outlined'
                        onClick={() => setShowHowToDialog(true)}
                    >
                        Как использовать функцию
                    </Button>
                    {dialogProps.type !== 'TEMPLATE' && (
                        <Button style={{ marginBottom: 10 }} variant='outlined' onClick={() => setToolFunc(exampleAPIFunc)}>
                            Показать пример
                        </Button>
                    )}
                    <CodeEditor
                        disabled={dialogProps.type === 'TEMPLATE'}
                        value={toolFunc}
                        height='calc(100vh - 220px)'
                        theme={customization.isDarkMode ? 'dark' : 'light'}
                        lang={'js'}
                        onValueChange={(code) => setToolFunc(code)}
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                {dialogProps.type === 'EDIT' && (
                    <StyledButton color='error' variant='contained' onClick={() => deleteTool()}>
                        Удалить
                    </StyledButton>
                )}
                {dialogProps.type === 'TEMPLATE' && (
                    <StyledButton color='secondary' variant='contained' onClick={useToolTemplate}>
                        Использовать шаблон
                    </StyledButton>
                )}
                {dialogProps.type !== 'TEMPLATE' && (
                    <StyledButton
                        disabled={!(toolName && toolDesc)}
                        variant='contained'
                        onClick={() => (dialogProps.type === 'ADD' || dialogProps.type === 'IMPORT' ? addNewTool() : saveTool())}
                    >
                        Добавить
                    </StyledButton>
                )}
            </DialogActions>
            <ConfirmDialog />
            <HowToUseFunctionDialog show={showHowToDialog} onCancel={() => setShowHowToDialog(false)} />
        </Dialog>
    ) : null

    return createPortal(component, portalElement)
}

ToolDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onUseTemplate: PropTypes.func,
    onCancel: PropTypes.func,
    onConfirm: PropTypes.func
}

export default ToolDialog
