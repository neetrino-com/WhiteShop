/**
 * Утилита для проверки и освобождения порта
 * Автоматически находит и останавливает процесс, занимающий указанный порт
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const isWindows = process.platform === 'win32';

/**
 * Находит PID процесса, использующего указанный порт
 * @param {number} port - Номер порта
 * @returns {Promise<number|null>} PID процесса или null, если порт свободен
 */
async function findProcessUsingPort(port) {
  try {
    if (isWindows) {
      // Windows: netstat -ano | findstr :PORT
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      const lines = stdout.trim().split('\n');
      
      for (const line of lines) {
        if (line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && !isNaN(pid)) {
            return parseInt(pid, 10);
          }
        }
      }
    } else {
      // Unix/Linux/Mac: lsof -ti:PORT
      const { stdout } = await execAsync(`lsof -ti:${port}`);
      const pid = stdout.trim();
      if (pid && !isNaN(pid)) {
        return parseInt(pid, 10);
      }
    }
    return null;
  } catch (error) {
    // Порт свободен, если команда не нашла процесс
    if (error.code === 1 || error.stdout === '') {
      return null;
    }
    throw error;
  }
}

/**
 * Останавливает процесс по PID
 * @param {number} pid - PID процесса
 * @returns {Promise<boolean>} true, если процесс успешно остановлен
 */
async function killProcess(pid) {
  try {
    if (isWindows) {
      await execAsync(`taskkill /PID ${pid} /F`);
    } else {
      await execAsync(`kill -9 ${pid}`);
    }
    return true;
  } catch (error) {
    console.error(`⚠️  Не удалось остановить процесс ${pid}:`, error.message);
    return false;
  }
}

/**
 * Проверяет и освобождает порт, если он занят
 * @param {number} port - Номер порта
 * @param {boolean} autoKill - Автоматически останавливать процесс (по умолчанию true)
 * @returns {Promise<boolean>} true, если порт свободен или был освобожден
 */
async function checkAndFreePort(port, autoKill = true) {
  console.log(`🔍 Проверка порта ${port}...`);
  
  const pid = await findProcessUsingPort(port);
  
  if (!pid) {
    console.log(`✅ Порт ${port} свободен`);
    return true;
  }

  console.log(`⚠️  Порт ${port} занят процессом с PID: ${pid}`);
  
  if (!autoKill) {
    return false;
  }

  console.log(`🛑 Попытка остановить процесс ${pid}...`);
  const killed = await killProcess(pid);
  
  if (killed) {
    // Небольшая задержка для освобождения порта
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Проверяем, освободился ли порт
    const stillOccupied = await findProcessUsingPort(port);
    if (!stillOccupied) {
      console.log(`✅ Порт ${port} успешно освобожден`);
      return true;
    } else {
      console.error(`❌ Порт ${port} все еще занят после остановки процесса`);
      return false;
    }
  }
  
  return false;
}

module.exports = {
  findProcessUsingPort,
  killProcess,
  checkAndFreePort,
};

