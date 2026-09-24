/**
 * Name pools for generated squad-mates.
 *
 * Teammates who are not marquee players are generated, and a generated name has
 * to be plausible for the nationality or the illusion breaks immediately — a
 * Brazilian winger called "Müller" reads as a bug. Pools are per country with a
 * neutral fallback.
 *
 * These are common real-world surnames and given names, used the way a name
 * generator uses them: combined at random into people who do not exist.
 */

interface NamePool {
  first: string[];
  last: string[];
  /** Brazilians and some others go by a single name. */
  mono?: string[];
}

export const NAME_POOLS: Record<string, NamePool> = {
  eng: {
    first: ['Jack', 'Harry', 'Callum', 'Reece', 'Tyler', 'Mason', 'Ollie', 'Kieran', 'Declan', 'Josh', 'Lewis', 'Conor'],
    last: ['Wright', 'Bailey', 'Hughes', 'Cole', 'Foster', 'Whitaker', 'Rowe', 'Doyle', 'Barnes', 'Chambers', 'Ashworth', 'Kelly'],
  },
  esp: {
    first: ['Pablo', 'Álvaro', 'Sergio', 'Iker', 'Marcos', 'Javier', 'Rubén', 'Adrián', 'Gonzalo', 'Nico', 'Hugo', 'Dani'],
    last: ['Serrano', 'Cabrera', 'Ibáñez', 'Vidal', 'Quintero', 'Palacios', 'Aguirre', 'Ferrán', 'Belmonte', 'Nadal', 'Ortega', 'Lucas'],
  },
  ita: {
    first: ['Matteo', 'Lorenzo', 'Andrea', 'Giacomo', 'Davide', 'Nicolò', 'Federico', 'Simone', 'Alessio', 'Tommaso'],
    last: ['Bernardi', 'Fontana', 'Marchetti', 'Rizzo', 'Caruso', 'Vitali', 'Lombardi', 'Grasso', 'Santoro', 'Pellegrini'],
  },
  ger: {
    first: ['Lukas', 'Jonas', 'Felix', 'Maximilian', 'Niklas', 'Tim', 'Julian', 'Moritz', 'Elias', 'Fabian'],
    last: ['Brandt', 'Keller', 'Wagner', 'Hoffmann', 'Krüger', 'Zimmer', 'Baumann', 'Reuter', 'Stark', 'Lindner'],
  },
  fra: {
    first: ['Théo', 'Lucas', 'Enzo', 'Matéo', 'Nathan', 'Yanis', 'Rayan', 'Noah', 'Gabin', 'Ilan'],
    last: ['Lefèvre', 'Moreau', 'Girard', 'Rousseau', 'Perrin', 'Fontaine', 'Barré', 'Chevalier', 'Marchand', 'Renard'],
  },
  bra: {
    first: ['Lucas', 'Gabriel', 'Matheus', 'Rafael', 'Vinícius', 'Bruno', 'Caio', 'Diego', 'Felipe', 'Igor'],
    last: ['Cardoso', 'Barbosa', 'Teixeira', 'Moreira', 'Nogueira', 'Ramos', 'Azevedo', 'Correia', 'Pinto', 'Duarte'],
    mono: ['Juninho', 'Rodriguinho', 'Fabinho', 'Serginho', 'Kaká', 'Everton', 'Wesley', 'Douglas', 'Éder', 'Tiago'],
  },
  arg: {
    first: ['Santiago', 'Lautaro', 'Julián', 'Tomás', 'Facundo', 'Nicolás', 'Franco', 'Agustín', 'Lucas', 'Matías'],
    last: ['Domínguez', 'Sosa', 'Benítez', 'Acosta', 'Ledesma', 'Peralta', 'Vega', 'Ferreyra', 'Molina', 'Ríos'],
  },
  ned: {
    first: ['Sven', 'Daan', 'Ruben', 'Jurriën', 'Thijs', 'Bram', 'Lars', 'Mees', 'Stijn', 'Joost'],
    last: ['van Dijk', 'de Vries', 'Bakker', 'Visser', 'Jansen', 'Koster', 'Smit', 'de Boer', 'Willems', 'Hendriks'],
  },
  por: {
    first: ['Rúben', 'Diogo', 'Tomás', 'Gonçalo', 'Rodrigo', 'Afonso', 'Miguel', 'Vasco', 'Duarte', 'Tiago'],
    last: ['Ferreira', 'Cardoso', 'Mendes', 'Neves', 'Fonseca', 'Braga', 'Antunes', 'Pinheiro', 'Marques', 'Lopes'],
  },
  chn: {
    first: ['伟', '磊', '浩然', '子豪', '宇轩', '嘉豪', '思远', '博文', '天翊', '皓宇'],
    last: ['王', '李', '张', '刘', '陈', '杨', '黄', '赵', '吴', '徐'],
  },
  jpn: {
    first: ['Sota', 'Haruto', 'Yuto', 'Riku', 'Kaito', 'Ren', 'Sora', 'Takumi', 'Daiki', 'Hinata'],
    last: ['Nakamura', 'Ishikawa', 'Fujita', 'Morita', 'Hashimoto', 'Ueda', 'Sakamoto', 'Ogawa', 'Kimura', 'Aoki'],
  },
  kor: {
    first: ['Min-jun', 'Ji-ho', 'Seo-jun', 'Do-yun', 'Ha-jun', 'Eun-woo', 'Si-woo', 'Ju-won', 'Tae-yang', 'Yun-ho'],
    last: ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Jang', 'Lim'],
  },
  ksa: {
    first: ['Abdullah', 'Mohammed', 'Faisal', 'Turki', 'Saleh', 'Nawaf', 'Yasser', 'Khalid', 'Sultan', 'Majed'],
    last: ['Al-Harbi', 'Al-Dawsari', 'Al-Otaibi', 'Al-Ghamdi', 'Al-Shehri', 'Al-Qahtani', 'Al-Zahrani', 'Al-Malki', 'Al-Amri', 'Al-Najei'],
  },
  nga: {
    first: ['Chidi', 'Emeka', 'Tunde', 'Ifeanyi', 'Kelechi', 'Obinna', 'Segun', 'Uche', 'Bright', 'Sunday'],
    last: ['Okafor', 'Adeyemi', 'Nwosu', 'Balogun', 'Eze', 'Okonkwo', 'Adebayo', 'Iheanacho', 'Onyeka', 'Chukwu'],
  },
  sen: {
    first: ['Moussa', 'Ibrahima', 'Cheikh', 'Papa', 'Ousmane', 'Lamine', 'Abdoulaye', 'Mamadou', 'Alioune', 'Serigne'],
    last: ['Diallo', 'Ndiaye', 'Fall', 'Gueye', 'Sarr', 'Diop', 'Cissé', 'Faye', 'Camara', 'Ba'],
  },
  tur: {
    first: ['Emre', 'Kerem', 'Arda', 'Berkay', 'Mert', 'Efe', 'Yusuf', 'Kaan', 'Onur', 'Barış'],
    last: ['Yıldız', 'Demir', 'Kaya', 'Şahin', 'Çelik', 'Aydın', 'Doğan', 'Arslan', 'Koç', 'Öztürk'],
  },
  usa: {
    first: ['Tyler', 'Brandon', 'Cole', 'Jordan', 'Aiden', 'Mason', 'Caleb', 'Hunter', 'Landon', 'Miles'],
    last: ['Morris', 'Sanders', 'Brooks', 'Reyes', 'Carter', 'Perez', 'Hayes', 'Bennett', 'Foster', 'Ramirez'],
  },
};

/** Used for any country without its own pool. */
export const FALLBACK_POOL: NamePool = {
  first: ['Adam', 'Marko', 'Luka', 'Ivan', 'Nikola', 'Andrei', 'Stefan', 'Milos', 'Filip', 'Denis'],
  last: ['Petrov', 'Kovač', 'Novak', 'Ilić', 'Popa', 'Marin', 'Horvat', 'Baros', 'Vidic', 'Radu'],
};

export function poolFor(countryId: string): NamePool {
  return NAME_POOLS[countryId] ?? FALLBACK_POOL;
}
